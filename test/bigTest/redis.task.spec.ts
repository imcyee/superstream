
import { Job, Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { GenericContainer } from "testcontainers";
import { getRedisAddress, setupRedisConfig } from "../../src/storage/redis/connection";
import { wait } from "../utils/wait";
 

const redisAddress = getRedisAddress()
// let connection = new IORedis(redisAddress);
let connection = {
  host: 'localhost',
  port: 6379
}
let fanoutQueue = new Queue("fanoutQueue", { connection })

const worker = new Worker("fanoutQueue", async (job: Job) => {
  console.log('working worker');
}, { connection })

describe("GenericContainer", () => {
  let container;


  beforeAll(async () => {

    // pull the image first
    container = await new GenericContainer("redis:6.2.5")
      // .withExposedPorts(6379)
      .withExposedPorts({
        container: 6379,
        host: 6379
      })
      .start();

    console.log('host', container.getHost(), container.getMappedPort(6379),);
    setupRedisConfig({
      host: container.getHost(),
      port: container.getMappedPort(6379),
    })


  });

  afterAll(async () => {

    // wait for statsd to flush out 
    await new Promise((r) => {
      setTimeout(r, 3000)
    })
    console.log('closing connection');

    // await fanoutQueue.close()
    // await fanoutHighPriorityQueue.close()
    // await fanoutLowPriorityQueue.close()
    // await followManyQueue.close()
    // await unfollowManyQueue.close()

    // await fanoutLowWorker.close()
    // await fanoutHighWorker.close()
    // await fanoutWorker.close()
    // await connection.disconnect()
    await fanoutQueue.close()
    await worker.close()
    await container.stop();
  });

  it('test', async () => {
    fanoutQueue.add('somequeue', {})
    await wait(6000)
  }, 10000)


});