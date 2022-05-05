import faker from 'faker';
import { GenericContainer } from "testcontainers";
import { RedisTestManager } from '../../../src/feedManagers/redis/RedisTestManager';
import { setupRedisConfig } from "../../../src/storage/redis/connection";
import { fanoutHighWorker, fanoutLowWorker, fanoutWorker } from '../../../src/task';
import { fanoutHighPriorityQueue, fanoutLowPriorityQueue, fanoutQueue, followManyQueue, unfollowManyQueue } from '../../../src/task_registration';
import { generateActivity } from '../../utils/generateActivity';
import { wait } from '../../utils/wait';


const defaultTaskTimeout = 8000

describe("GenericContainer", () => {
  let container;


  beforeAll(async () => {
    // pull the image first
    container = await new GenericContainer("redis:6.2.5")
      // .withExposedPorts(6379)
      .withExposedPorts({
        container: 6379,
        host: 6379
      })
      .start();

    setupRedisConfig({
      host: container.getHost(),
      port: container.getMappedPort(6379),
    })

  });

  afterAll(async () => {

    // wait for statsd to flush out 
    await wait(2500)  
    await fanoutQueue.close()
    await fanoutHighPriorityQueue.close()
    await fanoutLowPriorityQueue.close()
    await followManyQueue.close()
    await unfollowManyQueue.close()

    await fanoutLowWorker.close()
    await fanoutHighWorker.close()
    await fanoutWorker.close()  

    await container.stop(); 
  });


  it("Able to add user activity", async () => {
    const userId = faker.datatype.uuid()
    const feed = new RedisTestManager()

    const activity1 = generateActivity()
    await feed.addUserActivity(userId, activity1)

    // current user feed
    const userFeed = feed.getUserFeed(userId)
    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)
  });


  it("Able to fan out activities to follower", async () => {
    const userId = faker.datatype.uuid()
    const feed = new RedisTestManager()

    const followers = [
      faker.datatype.uuid(),
      faker.datatype.uuid()
    ]
    jest.spyOn(feed, 'getUserFollowerIds').mockImplementation(async () => ({
      'HIGH': followers
    }));
    const activity1 = generateActivity()
    await feed.addUserActivity(userId, activity1)

    // task is executed in seperated process
    await wait(2500)

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

    // task is executed in seperated process
    await wait(2500)
    // follower user feed
    const followerFeedItem2 = await followerFeed.getItem(0, 5)
    expect(followerFeedItem2.length).toBe(2)


  }, defaultTaskTimeout);

  it("Able to remove and remove fan out activities to follower", async () => {
    const userId = faker.datatype.uuid()
    const feed = new RedisTestManager()

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


    // task is executed in seperated process
    await wait(2500)


    const activities2 = await userFeed.getItem(0, 5)
    const followerFeedItem2 = await followerFeed.getItem(0, 5)
    expect(activities2.length).toBe(0)
    expect(followerFeedItem2.length).toBe(0)
  }, defaultTaskTimeout);

  it("follow user and copy content", async () => {
    const userId = faker.datatype.uuid()
    const feed = new RedisTestManager()

    const followers = []
    jest.spyOn(feed, 'getUserFollowerIds').mockImplementation(async () => ({
      'HIGH': followers
    }));

    const newUserId = faker.datatype.uuid()
    const activity1 = generateActivity({
      actor: `user:${userId}`,
      target: `user:${newUserId}`,
    })
    await feed.addUserActivity(userId, activity1)

    // current user feed
    const userFeed = feed.getUserFeed(userId)

    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)


    await feed.followUser(newUserId, userId)

    // task is executed in seperated process
    await wait(5000)

    const newUserFeed = feed.getUserFeed(newUserId)

    const activities1 = await newUserFeed.getItem(0, 5)

    expect(activities1.length).toBe(1)

  }, defaultTaskTimeout);

  it("unfollow user and remove copied content", async () => {
    const userId = faker.datatype.uuid()
    const feed = new RedisTestManager()

    const followers = []
    jest.spyOn(feed, 'getUserFollowerIds').mockImplementation(async () => ({
      'HIGH': followers
    }));

    const newUserId = faker.datatype.uuid()
    const activity1 = generateActivity({
      actor: `user:${userId}`,
      target: `user:${newUserId}`,
    })
    await feed.addUserActivity(userId, activity1)

    // current user feed
    const userFeed = feed.getUserFeed(userId)

    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)

    await feed.followUser(newUserId, userId)
    const newUserFeed = feed.getUserFeed(newUserId)

    // task is executed in seperated process
    await wait(2000)
    var newUserActivities = await newUserFeed.getItem(0, 5)
    expect(newUserActivities.length).toBe(1)


    await feed.unfollowUser(newUserId, userId)

    // task is executed in seperated process
    await wait(2000)
    newUserActivities = await newUserFeed.getItem(0, 5)
    expect(newUserActivities.length).toBe(0)


  }, defaultTaskTimeout);


});