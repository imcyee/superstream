import faker from 'faker';
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { setupRedisConfig } from '../../../src';
import { CassandraTestManager } from '../../../src/feedManagers/cassandra/CassandraTestManager';
import { runCassandraMigration } from '../../../src/storage/cassandra/cassandra.migration';
import { setupCassandraConnection } from '../../../src/storage/cassandra/connection';
import { setupTask } from '../../../src/task/setupTask';
import { generateActivity } from '../../utils/generateActivity';
import { wait } from '../../utils/wait';

const defaultTaskTimeout = 8000

describe("GenericContainer", () => {
  let container: StartedTestContainer
  let container2: StartedTestContainer
  let setupProps: Awaited<ReturnType<typeof setupTask>>

  beforeAll(async () => {
    // pull the image first
    const promise2 = new GenericContainer("redis:6.2.5")
      .withExposedPorts(6379)
      .start();
    const promise1 = new GenericContainer("cassandra:3.11.0")
      .withExposedPorts(9042) // 7000 for node, 9042 for client
      .start();

    const [c1, c2] = await Promise.all([promise1, promise2])
    container = c1
    container2 = c2

    const redisPort = container2.getMappedPort(6379)
    const redisHost = container2.getHost()
    setupRedisConfig({
      host: redisHost,
      port: redisPort,
    })

    setupCassandraConnection({
      // host: '192.168.0.146',// container.getHost(),
      host: container.getHost(),
      port: container.getMappedPort(9042),
    })

    setupProps = await setupTask({
      port: redisPort,
      host: redisHost
    })


    await runCassandraMigration()

    // task is executed in seperated process
    await wait(2500)
  }, 80000);

  afterAll(async () => {

    // wait for statsd to flush out 
    await wait(2500)
    await setupProps.shutdown()

    await container.stop()
    await container2.stop()
  });


  it("Able to add user activity", async () => {
    const userId = faker.datatype.uuid()
    const feedManager = new CassandraTestManager({ tasks: setupProps.taskQueues })
    await feedManager.addUserActivity(userId, generateActivity())
    // current user feed
    const userFeed = feedManager.getUserFeed(userId)
    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)
    expect(activities.length).toBe(1)
  }, 80000);


  it("Able to fan out activities to follower", async () => {
    const userId = faker.datatype.uuid()
    const feedManager = new CassandraTestManager({ tasks: setupProps.taskQueues })
    const followers = [
      faker.datatype.uuid(),
      faker.datatype.uuid()
    ]
    jest.spyOn(feedManager, 'getUserFollowerIds').mockImplementation(async () => ({
      'HIGH': followers
    }));

    const followerFeed = feedManager.getUserFeed(followers[0])
    const followerFeedItem0 = await followerFeed.getItem(0, 5)
    expect(followerFeedItem0.length).toBe(0)

    await feedManager.addUserActivity(userId, generateActivity())

    // current user feed
    const userFeed = feedManager.getUserFeed(userId)
    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)

    // fanout is slow if we test it right away we will get different result
    // task is executed in seperated process
    await wait(2500)

    // follower user feed 
    const followerFeedItem1 = await followerFeed.getItem(0, 5)
    expect(followerFeedItem1.length).toBe(1)

    // add another entry 
    await feedManager.addUserActivity(userId, generateActivity())

    // fanout is slow if we test it right away we will get different result
    // task is executed in seperated process
    await wait(2500)

    // follower user feed
    const followerFeedItem2 = await followerFeed.getItem(0, 5)
    expect(followerFeedItem2.length).toBe(2)
  }, defaultTaskTimeout);


  it("Able to remove and remove fan out activities to follower", async () => {
    const userId = faker.datatype.uuid()
    const feedManager = new CassandraTestManager({ tasks: setupProps.taskQueues })

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
    const activities2 = await userFeed.getItem(0, 5)

    // could generate error due to async that is not awaited fanout
    // there will be race condition
    // so a simple timeout to solve the race
    // task is executed in seperated process
    await wait(2500)

    const followerFeedItem2 = await followerFeed.getItem(0, 5)
    expect(activities2.length).toBe(0)
    expect(followerFeedItem2.length).toBe(0)
  }, defaultTaskTimeout);

  it("follow user and copy content", async () => {
    const userId = faker.datatype.uuid()
    const feedManager = new CassandraTestManager({ tasks: setupProps.taskQueues })
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
    await wait(2500)

    const newUserFeed = feedManager.getUserFeed(newUserId)
    const activities1 = await newUserFeed.getItem(0, 5)
    expect(activities1.length).toBe(1)

  }, defaultTaskTimeout);


  it("unfollow user and remove copied content", async () => {
    const userId = faker.datatype.uuid()
    const feedManager = new CassandraTestManager({ tasks: setupProps.taskQueues })

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
    await wait(2500)

    var newUserActivities = await newUserFeed.getItem(0, 5)
    expect(newUserActivities.length).toBe(1)


    await feedManager.unfollowUser(newUserId, userId)

    // task is executed in seperated process
    await wait(2500)

    newUserActivities = await newUserFeed.getItem(0, 5)
    expect(newUserActivities.length).toBe(0)

    // let async task to settle

    // task is executed in seperated process
    await wait(2500)
  }, defaultTaskTimeout);


});