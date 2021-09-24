import faker from 'faker';
import { GenericContainer } from "testcontainers";
import { Manager } from '../../src/feed_managers/base';
import { setupConfig } from "../../src/storage/redis/connection";
import { generateActivity } from '../utils/generateActivity';


/**
 * Test class for manager
 */
export class TestManager extends Manager {
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
    // pull the image first
    container = await new GenericContainer("redis:6.2.5")
      .withExposedPorts(6379)
      .start();

    setupConfig({
      host: container.getHost(),
      port: container.getMappedPort(6379),
    })
  });

  afterAll(async () => {
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
    const followerFeed = feed.getUserFeed(followers)
    const followerFeedItem = await userFeed.getItem(0, 5)
    expect(followerFeedItem.length).toBe(1)

    // add another entry
    const activity2 = generateActivity()
    await feed.addUserActivity(userId, activity2)

    // follower user feed
    const followerFeedItem2 = await userFeed.getItem(0, 5)
    expect(followerFeedItem2.length).toBe(2)
  });

});