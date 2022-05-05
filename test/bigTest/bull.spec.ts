
// import Queue from 'bull'
import { GenericContainer } from 'testcontainers';
import { getRedisAddress, setupRedisConfig } from '../../src';
import { Queue, Worker } from 'bullmq';



describe("bull queue", () => {

  let container;
  let testQueue: Queue<any, any, string>
  let worker: Worker

  beforeAll(async () => {
    // pull the image first
    container = await new GenericContainer("redis:6.2.5")
      .withExposedPorts(6379)
      .start();
    console.log(container.getHost(), container.getMappedPort(6379));
    setupRedisConfig({
      host: container.getHost(),
      port: container.getMappedPort(6379),
    })

    const redisAddress = getRedisAddress()
    console.log('redis', redisAddress);

    testQueue = new Queue('test', {
      connection: {
        port: container.getMappedPort(6379),
        host: '127.0.0.1'
      }
    });
    // testQueue.process(async (job, done) => {
    //   console.log('test');
    // })

    worker = new Worker('test', async job => {
      console.log('test');
      console.log('test2');
    }, {
      connection: {
        port: container.getMappedPort(6379),
        host: '127.0.0.1'
      }
    });
  });

  afterAll(async () => {

    // wait for statsd to flush out 
    await new Promise((r) => {
      setTimeout(r, 3000)
    })
    await worker.close()
    await testQueue.close()
    await container.stop();
  });


  it("test task", async () => {
    const promise = testQueue.add('testJob', {})
    console.log(promise);
    await promise
  }, 10000)
})
