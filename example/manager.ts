// test file
import { Manager, setupRedisConfig, Activity } from 'superstream'
import { GenericContainer } from "testcontainers";
import * as faker from 'faker'

/**
 * extend manager class
 * Test class for manager
 */
export class TestManager extends Manager {
  // override method to getUserFollowerIds
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

(async () => {
  const manager = new TestManager()
  // pull the image first
  const container = await new GenericContainer("redis:6.2.5")
    .withExposedPorts(6379)
    .start();

  setupRedisConfig({
    host: container.getHost(),
    port: container.getMappedPort(6379),
  })
  const userId = faker.datatype.uuid()

  // create activity
  const activity = new Activity({
    actor: `user:${faker.datatype.uuid()}`,
    verb: faker.random.arrayElement([`cinema:book`, 'themepark:go']),
    object: `movie:${faker.datatype.number()}`,
  })


  await manager.addUserActivity(userId, activity)

  // get current user feed
  const userFeed = manager.getUserFeed(userId)

  const activities = await userFeed.getItem(0, 5)
  console.log('activities: ', activities);
})()