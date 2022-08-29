
import { Job, Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { GenericContainer } from "testcontainers";
import { setupRedisConfig } from "../../src/storage/redis/connection";
import { wait } from "../utils/wait";


describe("GenericContainer", () => {
  let container;
  let worker
  let fanoutQueue
  let connection: IORedis

  let shutdown

  beforeAll(async () => {
    // pull the image first
    container = await new GenericContainer("redis:6.2.5")
      .withExposedPorts(6379)
      .start();
    const redisPort = container.getMappedPort(6379)
    const redisHost = container.getHost()
    connection = new IORedis({
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: null
    })
    fanoutQueue = new Queue("fanoutQueue", { connection })
    worker = new Worker("fanoutQueue", async (job: Job) => {
      console.log('working worker');
    }, { connection })
    console.log('host', container.getHost(), container.getMappedPort(6379),);
    setupRedisConfig({
      host: container.getHost(),
      port: container.getMappedPort(6379),
    })

    shutdown = async () => {
      await fanoutQueue.close()
      await worker.close()
      await connection.disconnect()
      await container.stop();
    }

  });

  afterAll(async () => {
    await wait(2500)
    await shutdown()
  });

  it('test', async () => {
    fanoutQueue.add('somequeue', {})
    await wait(6000)
  }, 10000)


});