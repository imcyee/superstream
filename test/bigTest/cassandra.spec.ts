import faker from 'faker';
import { GenericContainer } from "testcontainers";
import { Activity } from "../../src/activity/Activity";
import { CassandraFeed } from '../../src/feeds/cassandra';
import { runCassandraMigration } from '../../src/storage/cassandra/cassandra.migration';
import { setupCassandraConnection } from '../../src/storage/cassandra/connection';
import { generateActivity } from '../utils/generateActivity';

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
  }, 50000);

  afterAll(async () => {
    await container.stop();
  });

  it("CassandraFeed able to read and write", async () => {
    const userId = faker.datatype.uuid()
    const feed = new CassandraFeed(userId)
    const activity1 = generateActivity()
    await feed.add(activity1)
    const result = await feed.getItem(0, 5)
    expect(result.length).toBe(1)
  }, 20000);

  it("CassandraFeed able to read and write consecutively", async () => {
    const userId = faker.datatype.uuid()
    const feed = new CassandraFeed(userId)
    const activity1 = generateActivity()
    const activity2 = generateActivity()

    await feed.add(activity1)
    await feed.add(activity2)
    const result2 = await feed.getItem(0, 5)

    expect(result2.length).toBe(2)
  });

  it("CassandraFeed value input and output are equal", async () => {
    const userId = faker.datatype.uuid()
    const feed = new CassandraFeed(userId)
    const activityPayload = {
      actor: `user:${faker.datatype.uuid()}`,
      verb: `cinema:book`,
      object: `movie:${faker.datatype.number()}`,
    }
    const activity1 = new Activity(activityPayload)
    const initialJSON = activity1.toJSON()

    await feed.add(activity1)
    const result = await feed.getItem(0, 5)

    const r = result[0]
    const activityJSON = r.toJSON()

    const activityJSONKey = Object.keys(activityJSON)
    activityJSONKey.forEach((key) => {
      if (key === 'time') {
        return new Date(activityJSON[key]).getTime() === new Date(initialJSON[key]).getTime()
      } else if (key === 'context') {
        return
      }

      expect(activityJSON[key]).toBe(initialJSON[key])
    })
  })

});