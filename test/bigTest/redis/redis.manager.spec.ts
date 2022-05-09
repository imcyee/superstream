import { faker } from '@faker-js/faker';
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { RedisTestManager } from '../../../src/feedManagers/redis/RedisTestManager';
import { setupRedisConfig } from "../../../src/storage/redis/connection";
import { setupTask } from '../../../src/task/setupTask';
import { generateActivity } from '../../utils/generateActivity';
import { wait } from '../../utils/wait';

const defaultTaskTimeout = 8000

describe("GenericContainer", () => {
  let container: StartedTestContainer;
  let setupProps: Awaited<ReturnType<typeof setupTask>>

  beforeAll(async () => {
    container = await new GenericContainer("redis:6.2.5")
      .withExposedPorts(6379)
      .start();
    const redisPort = container.getMappedPort(6379)
    const redisHost = container.getHost()
    setupRedisConfig({
      host: redisHost,
      port: redisPort,
    })
    setupProps = await setupTask({
      host: redisHost,
      port: redisPort,
    })

  }, 50000);

  afterAll(async () => {
    // wait for statsd to flush out 
    await wait(2500)
    await setupProps.shutdown()
    await container.stop();
  });


  it("Able to add user activity", async () => {
    const userId = faker.datatype.uuid()
    const feedManager = new RedisTestManager({ tasks: setupProps.taskQueues })

    const activity1 = generateActivity()
    await feedManager.addUserActivity(userId, activity1)

    // current user feed
    const userFeed = feedManager.getUserFeed(userId)
    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)
  });


  it("Able to fan out activities to follower", async () => {
    const userId = faker.datatype.uuid()
    const feedManager = new RedisTestManager({ tasks: setupProps.taskQueues })

    const followers = [
      faker.datatype.uuid(),
      faker.datatype.uuid()
    ]
    jest.spyOn(feedManager, 'getUserFollowerIds').mockImplementation(async () => ({
      'HIGH': followers
    }));
    const activity1 = generateActivity()
    await feedManager.addUserActivity(userId, activity1)

    // task is executed in seperated process
    await wait(2500)

    // current user feed
    const userFeed = feedManager.getUserFeed(userId)
    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)

    // follower user feed
    const followerFeed = feedManager.getUserFeed(followers[0])

    const followerFeedItem = await followerFeed.getItem(0, 5)
    expect(followerFeedItem.length).toBe(1)

    // add another entry
    const activity2 = generateActivity()
    await feedManager.addUserActivity(userId, activity2)

    // task is executed in seperated process
    await wait(2500)
    // follower user feed
    const followerFeedItem2 = await followerFeed.getItem(0, 5)
    expect(followerFeedItem2.length).toBe(2)

  }, defaultTaskTimeout);


  it("Able to remove and remove fan out activities to follower", async () => {
    const userId = faker.datatype.uuid()
    const feedManager = new RedisTestManager({ tasks: setupProps.taskQueues })

    const followers = [
      faker.datatype.uuid(),
      faker.datatype.uuid()
    ]
    jest.spyOn(feedManager, 'getUserFollowerIds').mockImplementation(async () => ({
      'HIGH': followers
    }));

    const activity1 = generateActivity()
    await feedManager.addUserActivity(userId, activity1)

    // current user feed
    const userFeed = feedManager.getUserFeed(userId)
    const followerFeed = feedManager.getUserFeed(followers[0])

    const activities = await userFeed.getItem(0, 5)
    const followerFeedItem = await followerFeed.getItem(0, 5)
    expect(activities.length).toBe(1)
    expect(followerFeedItem.length).toBe(1)

    await feedManager.removeUserActivity(userId, activity1)


    // task is executed in seperated process
    await wait(2500)


    const activities2 = await userFeed.getItem(0, 5)
    const followerFeedItem2 = await followerFeed.getItem(0, 5)
    expect(activities2.length).toBe(0)
    expect(followerFeedItem2.length).toBe(0)
  }, defaultTaskTimeout);

  it("follow user and copy content", async () => {
    const userId = faker.datatype.uuid()
    const feedManager = new RedisTestManager({ tasks: setupProps.taskQueues })

    const followers = []
    jest.spyOn(feedManager, 'getUserFollowerIds').mockImplementation(async () => ({
      'HIGH': followers
    }));

    const newUserId = faker.datatype.uuid()
    const activity1 = generateActivity({
      actor: `user:${userId}`,
      target: `user:${newUserId}`,
    })
    await feedManager.addUserActivity(userId, activity1)

    // current user feed
    const userFeed = feedManager.getUserFeed(userId)

    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)


    await feedManager.followUser(newUserId, userId)

    // task is executed in seperated process
    await wait(5000)

    const newUserFeed = feedManager.getUserFeed(newUserId)

    const activities1 = await newUserFeed.getItem(0, 5)

    expect(activities1.length).toBe(1)

  }, defaultTaskTimeout);

  
  it("unfollow user and remove copied content", async () => {
    const userId = faker.datatype.uuid()
    const feedManager = new RedisTestManager({ tasks: setupProps.taskQueues })

    const followers = []
    jest.spyOn(feedManager, 'getUserFollowerIds').mockImplementation(async () => ({
      'HIGH': followers
    }));

    const newUserId = faker.datatype.uuid()
    const activity1 = generateActivity({
      actor: `user:${userId}`,
      target: `user:${newUserId}`,
    })
    await feedManager.addUserActivity(userId, activity1)

    // current user feed
    const userFeed = feedManager.getUserFeed(userId)

    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)

    await feedManager.followUser(newUserId, userId)
    const newUserFeed = feedManager.getUserFeed(newUserId)

    // task is executed in seperated process
    await wait(2000)
    var newUserActivities = await newUserFeed.getItem(0, 5)
    expect(newUserActivities.length).toBe(1)


    await feedManager.unfollowUser(newUserId, userId)

    // task is executed in seperated process
    await wait(2000)
    newUserActivities = await newUserFeed.getItem(0, 5)
    expect(newUserActivities.length).toBe(0)


  }, defaultTaskTimeout);


});