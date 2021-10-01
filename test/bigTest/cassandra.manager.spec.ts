import faker from 'faker';
import { GenericContainer } from "testcontainers";
import { CassandraFeed } from '../../src/feeds/cassandra';
import { CassandraManager } from '../../src/feed_managers/CassandraManager';
import { runCassandraMigration } from '../../src/storage/cassandra/cassandra.migration';
import { setupCassandraConnection } from '../../src/storage/cassandra/connection';
import { setupRedisConfig } from "../../src/storage/redis/connection";
import { generateActivity } from '../utils/generateActivity';


/**
 * Test class for manager
 */
export class TestManager extends CassandraManager {

  async getUserFollowerIds() {
    return {
      HIGH: [
        faker.datatype.uuid(),
        faker.datatype.uuid(),
        faker.datatype.uuid(),
        faker.datatype.uuid(),
      ]
    }
  }
}

describe("GenericContainer", () => {
  let container;

  // beforeAll(async () => {
  //   // pull the image first
  //   container = await new GenericContainer("redis:6.2.5")
  //     .withExposedPorts(6379)
  //     .start();

  //   setupRedisConfig({
  //     host: container.getHost(),
  //     port: container.getMappedPort(6379),
  //   })
  // });

  beforeAll(async () => {
    container = await new GenericContainer("cassandra:3.11.0")
      .withExposedPorts(9042) // 7000 for node, 9042 for client
      .start();

    setupCassandraConnection({
      host: '192.168.0.146',// container.getHost(),
      port: container.getMappedPort(9042),
    })

    await runCassandraMigration()
  }, 50000);

  afterAll(async () => {

    // wait for statsd to flush out 
    await new Promise((r) => {
      setTimeout(r, 3000)
    })
    await container.stop();
  });


  it("Able to add user activity", async () => {
    const userId = faker.datatype.uuid()
    const feed = new TestManager()

    const activity1 = generateActivity()
    await feed.addUserActivity(userId, activity1)

    // current user feed
    const userFeed = feed.getUserFeed(userId)
    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)
  });


  it("Able to fan out activities to follower", async () => {
    const userId = faker.datatype.uuid()
    const feed = new TestManager()

    const followers = [
      faker.datatype.uuid(),
      faker.datatype.uuid()
    ]
    jest.spyOn(feed, 'getUserFollowerIds').mockImplementation(async () => ({
      'HIGH': followers
    }));
    const activity1 = generateActivity()
    await feed.addUserActivity(userId, activity1)

    // current user feed
    const userFeed = feed.getUserFeed(userId)
    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)

    // follower user feed
    const followerFeed = feed.getUserFeed(followers[0])
    const followerFeedItem = await followerFeed.getItem(0, 5)
    console.log(followerFeedItem);
    expect(followerFeedItem.length).toBe(1)

    // add another entry
    const activity2 = generateActivity()
    await feed.addUserActivity(userId, activity2)

    // follower user feed
    const followerFeedItem2 = await followerFeed.getItem(0, 5)
    expect(followerFeedItem2.length).toBe(2)


  });

  it("Able to remove and remove fan out activities to follower", async () => {
    const userId = faker.datatype.uuid()
    const feed = new TestManager()

    const followers = [
      faker.datatype.uuid(),
      faker.datatype.uuid()
    ]
    jest.spyOn(feed, 'getUserFollowerIds').mockImplementation(async () => ({
      'HIGH': followers
    }));

    const activity1 = generateActivity()
    await feed.addUserActivity(userId, activity1)

    // current user feed
    const userFeed = feed.getUserFeed(userId)
    const followerFeed = feed.getUserFeed(followers[0])

    const activities = await userFeed.getItem(0, 5)
    const followerFeedItem = await followerFeed.getItem(0, 5)
    expect(activities.length).toBe(1)
    expect(followerFeedItem.length).toBe(1)

    await feed.removeUserActivity(userId, activity1)

    const activities2 = await userFeed.getItem(0, 5)
    const followerFeedItem2 = await followerFeed.getItem(0, 5)
    expect(activities2.length).toBe(0)
    expect(followerFeedItem2.length).toBe(0)
  });

  it("follow user and copy content", async () => {
    const userId = faker.datatype.uuid()
    const feed = new TestManager()

    const followers = []
    jest.spyOn(feed, 'getUserFollowerIds').mockImplementation(async () => ({
      'HIGH': followers
    }));

    const activity1 = generateActivity({
      actor: userId
    })
    await feed.addUserActivity(userId, activity1)

    // current user feed
    const userFeed = feed.getUserFeed(userId)

    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)

    const newUserId = faker.datatype.uuid()

    await feed.followUser(newUserId, userId)

    const newUserFeed = feed.getUserFeed(newUserId)

    const activities1 = await newUserFeed.getItem(0, 5)
    expect(activities1.length).toBe(1)

  });

  it("unfollow user and remove copied content", async () => {
    const userId = faker.datatype.uuid()
    const feed = new TestManager()

    const followers = []
    jest.spyOn(feed, 'getUserFollowerIds').mockImplementation(async () => ({
      'HIGH': followers
    }));

    const activity1 = generateActivity({
      actor: userId
    })
    await feed.addUserActivity(userId, activity1)

    // current user feed
    const userFeed = feed.getUserFeed(userId)

    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)

    const newUserId = faker.datatype.uuid()

    await feed.followUser(newUserId, userId)
    const newUserFeed = feed.getUserFeed(newUserId)

    var newUserActivities = await newUserFeed.getItem(0, 5)
    expect(newUserActivities.length).toBe(1)


    await feed.unfollowUser(newUserId, userId)
    newUserActivities = await newUserFeed.getItem(0, 5)
    expect(newUserActivities.length).toBe(0)


  });


});