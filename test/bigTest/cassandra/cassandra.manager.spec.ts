import faker from 'faker';
import { GenericContainer } from "testcontainers";
import { CassandraManager } from '../../../src/feedManagers/CassandraManager';
import { runCassandraMigration } from '../../../src/storage/cassandra/cassandra.migration';
import { setupCassandraConnection } from '../../../src/storage/cassandra/connection';
import { generateActivity } from '../../utils/generateActivity';


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

  beforeAll(async () => {
    container = await new GenericContainer("cassandra:3.11.0")
      .withExposedPorts(9042) // 7000 for node, 9042 for client
      .start();


    setupCassandraConnection({
      // host: '192.168.0.146',// container.getHost(),
      host: container.getHost(),
      port: container.getMappedPort(9042),
    })

    await runCassandraMigration()
    await new Promise(r => setTimeout(r, 1000))
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
    await feed.addUserActivity(userId, generateActivity())

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

    const followerFeed = feed.getUserFeed(followers[0])
    const followerFeedItem0 = await followerFeed.getItem(0, 5)
    expect(followerFeedItem0.length).toBe(0)

    await feed.addUserActivity(userId, generateActivity())

    // current user feed
    const userFeed = feed.getUserFeed(userId)
    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)

    // follower user feed 
    const followerFeedItem1 = await followerFeed.getItem(0, 5)
    expect(followerFeedItem1.length).toBe(1)

    // add another entry 
    await feed.addUserActivity(userId, generateActivity())

    // fanout is slow if we test it right away we will get different result
    await new Promise(r => setTimeout(r, 1000))

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
    // could generate error due to async that is not awaited fanout
    // there will be race condition
    // so a simple timeout to solve the race
    await new Promise(r => setTimeout(r, 1000))
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
    await new Promise(r => setTimeout(r, 1000))
    newUserActivities = await newUserFeed.getItem(0, 5)
    expect(newUserActivities.length).toBe(0)

    // let async task to settle
    await new Promise(r => setTimeout(r, 1000))
  });


});