import faker from 'faker';
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { RedisAggregatedFeed } from '../../../src/feeds/aggregated_feed/RedisAggregatedFeed';
import { setupRedisConfig } from "../../../src/storage/redis/connection";
import { generateActivity } from '../../utils/generateActivity';
import { wait } from '../../utils/wait';

describe("GenericContainer", () => {
  let container: StartedTestContainer;

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
    await wait(2500)
  });

  it("RedisFeed able to read and write", async () => {
    const userId = faker.datatype.uuid()
    const feed = new RedisAggregatedFeed(userId)
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

    // issue with current serializer that can generate collision 
    // if activity is created at the same time
    for await (let aggregated of aggregatedActivities) {
      await RedisAggregatedFeed.insertActivities(aggregated.activities)
    }

    await feed.addManyAggregated(aggregatedActivities)

    const result = await feed.getItem(0, 5)
    var totalActivities = 0
    result.forEach(element => {
      totalActivities += element.activities.length
    });

    expect(totalActivities).toBe(generatedNumber)

  });

});