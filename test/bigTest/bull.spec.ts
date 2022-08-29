
// import Queue from 'bull'
import { GenericContainer } from 'testcontainers';
import { setupRedisConfig } from '../../src';
import { Queue, Worker } from 'bullmq';
import { wait } from '../utils/wait';

describe("bull queue", () => {

  let container;
  let testQueue: Queue<any, any, string>
  let worker: Worker

  beforeAll(async () => {
    // pull the image first
    container = await new GenericContainer("redis:6.2.5")
      .withExposedPorts(6379)
      .start();

    setupRedisConfig({
      host: container.getHost(),
      port: container.getMappedPort(6379),
    })

    testQueue = new Queue('test', {
      connection: {
        port: container.getMappedPort(6379),
        host: '127.0.0.1'
      }
    });

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
    await wait(2500)
    await worker.close()
    await testQueue.close()
    await container.stop();
  });


  it("test task", async () => {
    const promise = testQueue.add('testJob', {})
    await promise
  }, 10000)
})
