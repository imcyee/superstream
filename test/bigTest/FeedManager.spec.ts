import faker from 'faker';
import { GenericContainer } from "testcontainers";
import { TestManager } from '../../src/feed_managers/TestManager';
import { setupConfig } from "../../src/storage/redis/connection";
import { generateActivity } from '../utils/generateActivity';

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

  it("RedisFeed able to read and write", async () => {
    const userId = faker.datatype.uuid()
    const feed = new TestManager()

    const activity1 = generateActivity()
    await feed.addUserActivity(userId, activity1)

    const userFeed = feed.getUserFeed(userId)
    const activities = await userFeed.getItem(0, 5)

    expect(activities.length).toBe(1)

  });

});