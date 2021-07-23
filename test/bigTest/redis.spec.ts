import faker from 'faker';
import { GenericContainer } from "testcontainers";
import { Activity } from "../../src/activity/Activity";
import { RedisFeed } from '../../src/feeds/RedisFeed';
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
    const feed = new RedisFeed(userId)

    const activity1 = generateActivity()
    await RedisFeed.insertActivity(activity1)

    await feed.add(activity1)

    const result = await feed.getItem(0, 5)

    expect(result.length).toBe(1)
  });

  it("RedisFeed able to read and write 2", async () => {
    const userId = faker.datatype.uuid()
    const feed = new RedisFeed(userId)

    const activity1 = generateActivity()
    const activity2 = generateActivity()

    await RedisFeed.insertActivity(activity1)
    await RedisFeed.insertActivity(activity2)

    await feed.add(activity1)
    await feed.add(activity2)

    const result = await feed.getItem(0, 5)

    expect(result.length).toBe(2)
  });

  it("RedisFeed value input and output are equal", async () => {
    const userId = faker.datatype.uuid()
    const feed = new RedisFeed(userId)
    const activityPayload = {
      actor: `user:${faker.datatype.uuid()}`,
      verb: `cinema:book`,
      object: `movie:${faker.datatype.number()}`,
    }
    const activity1 = new Activity(activityPayload)
    const initialJSON = activity1.toJSON()

    await RedisFeed.insertActivity(activity1)
    await feed.add(activity1)
    const result = await feed.getItem(0, 5)

    const r = result[0]
    const activityJSON = r.toJSON()

    const activityJSONKey = Object.keys(activityJSON)
    activityJSONKey.forEach((key) => {
      if (key === 'time') {
        return new Date(activityJSON[key]).getTime() === new Date(initialJSON[key]).getTime()
      } else if (key === 'extraContext') {
        return
      }
      expect(activityJSON[key]).toBe(initialJSON[key])
    })
  });
});