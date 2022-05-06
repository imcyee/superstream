// Not tested example
import { Manager, setupRedisConfig, Activity, RegisterManager, setupTask } from 'superstream'
import { GenericContainer } from "testcontainers";
import * as faker from 'faker'

/**
 * Extend manager class
 * Test class for manager
 */
@RegisterManager()
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
  // pull Redis image 
  const redisContainer = await new GenericContainer("redis:6.2.5")
    .withExposedPorts(6379)
    .start();

  // storage configuration
  setupRedisConfig({
    host: redisContainer.getHost(),
    port: redisContainer.getMappedPort(6379),
  })

  // task configuration
  const setupProps = await setupTask({
    host: redisContainer.getHost(),
    port: redisContainer.getMappedPort(6379),
  })

  // after storage and task are successfully started
  const managerFeed = new TestManager()
  const userId = faker.datatype.uuid()

  // create activity
  const activity = new Activity({
    actor: `user:${faker.datatype.uuid()}`,
    verb: faker.random.arrayElement([`cinema:book`, 'themepark:go']),
    object: `movie:${faker.datatype.number()}`,
  })
 
  await managerFeed.addUserActivity(userId, activity)

  // get current user feed
  const userFeed = managerFeed.getUserFeed(userId)

  const activities = await userFeed.getItem(0, 5)
  console.log('activities: ', activities);

  // cleanup
  return async () => {
    await setupProps.shutdown()
    await redisContainer.stop()
  }
})()