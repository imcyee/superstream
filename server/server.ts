import createDebug from 'debug';
import express from 'express';
import morgan from 'morgan';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { runCassandraMigration } from '../src/storage/cassandra/cassandra.migration';
import { setupCassandraConnection } from "../src/storage/cassandra/connection";
import { getRedisConnection, setupRedisConfig } from "../src/storage/redis/connection";
import { setupTask } from '../src/task/setupTask';
import routes from './routes';

const { createBullBoard } = require('@bull-board/api')
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter') 
const { ExpressAdapter } = require('@bull-board/express');

const debug = createDebug('superstream:server')
const app = express()

/**
 * global singleton
 */
let taskProps: Awaited<ReturnType<typeof setupTask>>
export function getTaskProps() {
  return taskProps
}

export const startServer = async (storageName) => {
  // var storageName = getStorageName()

  var redisContainer: StartedTestContainer
  var cassandraContainer: StartedTestContainer

  redisContainer = await new GenericContainer("redis:6.2.5")
    .withExposedPorts(6379)
    .start();

  setupRedisConfig({
    host: redisContainer.getHost(),
    port: redisContainer.getMappedPort(6379),
  })
  taskProps = await setupTask({
    host: redisContainer.getHost(),
    port: redisContainer.getMappedPort(6379),
  })

  switch (storageName) {
    case 'redis':
      getRedisConnection()
      break
    case 'cassandra':
      cassandraContainer = await new GenericContainer("cassandra:3.11.0")
        .withExposedPorts(9042) // 7000 for node, 9042 for client
        .start();

      setupCassandraConnection({
        host: cassandraContainer.getHost(),
        port: cassandraContainer.getMappedPort(9042),
      })

      await runCassandraMigration()
      break
  }


  app.use(morgan('combined'))
  app.use(express.json());// parse json request body
  app.use(express.urlencoded({ extended: true }));// parse urlencoded request body
  app.use('/v1', routes)

  const port = 8282
  app.listen(port, () => {
    console.info(`Listening to port ${port}`);
  });

  /**
   * Bull mq ui
   */
  const serverAdapter = new ExpressAdapter();
  const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
    queues: [
      new BullMQAdapter(taskProps.taskQueues.fanoutQueue),
      new BullMQAdapter(taskProps.taskQueues.followManyQueue),
      new BullMQAdapter(taskProps.taskQueues.unfollowManyQueue)
    ],
    serverAdapter: serverAdapter,
  });
  serverAdapter.setBasePath('/admin/queues');
  app.use('/admin/queues', serverAdapter.getRouter());

  process.on('exit', async function () {
    console.log('Goodbye!');
    await taskProps.shutdown()
    await redisContainer.stop()
    await cassandraContainer.stop()
  });
  return app
}

