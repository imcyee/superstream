import faker from 'faker';
import { GenericContainer } from "testcontainers";
import { RedisNotificationFeed } from '../../../src/feeds/notification_feed/RedisNotificationFeed';
import { setupRedisConfig } from "../../../src/storage/redis/connection";
import { generateActivity } from '../../utils/generateActivity';

describe("GenericContainer", () => {
  let container;

  beforeAll(async () => {
    // pull the image first
    container = await new GenericContainer("redis:6.2.5")
      .withExposedPorts(6379)
      .start();

    setupRedisConfig({
      host: container.getHost(),
      port: container.getMappedPort(6379),
    })
  });

  afterAll(async () => {
    await container.stop();
  });

  it("RedisFeed able to read and write", async () => {
    const userId = faker.datatype.uuid()
    const feed = new RedisNotificationFeed(userId)
    const generatedNumber = 5
    const activities = []

    const placeholderArrays = Array(generatedNumber).fill(1)
    for await (const i of placeholderArrays) {
      await new Promise((r) => {
        setTimeout(() => {
          r(activities.push(generateActivity()))
        }, 50)
      })
    }

    const aggregator = feed.getAggregator()
    const aggregatedActivities = aggregator.aggregate(activities)

    // // issue with current serializer that can generate collision 
    // // if activity is created at the same time
    // for await (let aggregated of aggregatedActivities) {
    //   await RedisNotificationFeed.insertActivities(aggregated.activities)
    // }

    await feed.addManyAggregated(aggregatedActivities) 
    const result = await feed.getItem(0, 5) 
    var totalActivities = 0
    result.forEach(element => {
      totalActivities += element.activities.length
    });

    expect(totalActivities).toBe(generatedNumber)

  });

});