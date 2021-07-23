import faker from 'faker';
import { GenericContainer } from "testcontainers";
import { Activity } from "../src/activity/Activity";
import { RedisFeed } from '../src/feeds/RedisFeed';
import { setupConfig } from "../src/storage/redis/connection";


const main = async () => {
  // we use test container to test real redis enviroment
  const container = await new GenericContainer("redis")
    .withExposedPorts(6379)
    .start();

  setupConfig({
    host: container.getHost(),
    port: container.getMappedPort(6379),
  })


  const userId = faker.datatype.uuid()
  const feed = new RedisFeed(userId)
  const activity1 = new Activity({
    actor: `user:${faker.datatype.uuid()}`,
    verb: `cinema:book`,
    object: `movie:${faker.datatype.number()}`
  })
  await RedisFeed.insertActivity(activity1)
  await feed.add(activity1)

  const result = await feed.getItem(0, 5)
  console.log(result);

  // tear down
  await container.stop()
}

main()