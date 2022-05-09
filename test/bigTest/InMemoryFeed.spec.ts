import { faker } from '@faker-js/faker';
import { generateActivity } from '../utils/generateActivity';
import { InMemoryFeed } from '../../src/feeds/InMemoryFeed'
import { Activity } from '../../src';

describe("GenericContainer", () => {

  it("InMemory able to read and write", async () => {
    const userId = faker.datatype.uuid()
    const feed = new InMemoryFeed(userId)
    const activity1 = generateActivity()
    await InMemoryFeed.insertActivity(activity1)
    await feed.add(activity1)
    const result = await feed.getItem(0, 5)
    expect(result.length).toBe(1)
  }, 20000);


  it("InMemoryFeed able to read and write 2", async () => {
    const userId = faker.datatype.uuid()
    const feed = new InMemoryFeed(userId)

    const activity1 = generateActivity()
    const activity2 = generateActivity()

    await InMemoryFeed.insertActivity(activity1)
    await InMemoryFeed.insertActivity(activity2)

    await feed.add(activity1)
    await feed.add(activity2)

    const result = await feed.getItem(0, 5)

    expect(result.length).toBe(2)
  });

  it("InMemoryFeed value input and output are equal", async () => {
    const userId = faker.datatype.uuid()
    const feed = new InMemoryFeed(userId)
    const activityPayload = {
      actor: `user:${faker.datatype.uuid()}`,
      verb: `cinema:book`,
      object: `movie:${faker.datatype.number()}`,
    }
    const activity1 = new Activity(activityPayload)
    const initialJSON = activity1.toJSON()

    await InMemoryFeed.insertActivity(activity1)
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
  });
});