import createDebug from 'debug';
import express from 'express';
import morgan from 'morgan';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { runCassandraMigration } from '../src/storage/cassandra/cassandra.migration';
import { setupCassandraConnection } from "../src/storage/cassandra/connection";
import { getRedisConnection, setupRedisConfig } from "../src/storage/redis/connection";
import routes from './routes';
import { getStorageName } from './utils/getStorageName';

const debug = createDebug('superstream:server')
const app = express()

const main = async () => {
  var storageName = getStorageName()

  var container: StartedTestContainer
  var container2: StartedTestContainer
  switch (storageName) {
    case 'redis':
      container = await new GenericContainer("redis:6.2.5")
        .withExposedPorts({ container: 6379, host: 6379 })
        .start();

      setupRedisConfig({
        host: container.getHost(),
        port: container.getMappedPort(6379),
      })

      // setupRedisConfig({
      //   port: 6379,
      //   host: '192.168.0.146'
      // })
      getRedisConnection()


      break
    case 'cassandra':
      // container = await new GenericContainer("cassandra:3.11.0")
      //   .withExposedPorts(9042) // 7000 for node, 9042 for client
      //   .start();
      // console.log('port: ' , container.getMappedPort(9042));
      // setupCassandraConnection({
      //   host: '192.168.0.146',// container.getHost(),
      //   port: container.getMappedPort(9042),
      //   // port: 9042
      // })
      // await runCassandraMigration()
      container = await new GenericContainer("redis:6.2.5")
        .withExposedPorts({ container: 6379, host: 6379 })
        .start();

      setupRedisConfig({
        host: container.getHost(),
        port: container.getMappedPort(6379),
      })

      container2 = await new GenericContainer("cassandra:3.11.0")
        .withExposedPorts(9042) // 7000 for node, 9042 for client
        .start();
      console.log(container.getHost(), container.getMappedPort(9042));

      setupCassandraConnection({
        // host: '192.168.0.146',// container.getHost(),
        host: container2.getHost(),
        port: container2.getMappedPort(9042),
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
}

main()


  // const Mapper = cassandra.mapping.Mapper;
  // const Client = cassandra.Client
  // const UnderscoreCqlToCamelCaseMappings = cassandra.mapping.UnderscoreCqlToCamelCaseMappings;

  // const client = getClient()

  // client.connect().then(async () => {

  //   const cassandra = new CassandraTimelineStorage({
  //     SerializerClass: SimpleTimelineSerializer,
  //     columnFamilyName: "feeds"
  //   })

  //   // cassandra.trim('feed_uuuusrrrrr:123', 10)
  //   // // // runCassandraMigration()
  //   // const cassandraFeed = new CassandraFeed( 'user:123' )

  //   // const activity = new Activity({
  //   //   actor: 'user:123',
  //   //   verb: 'pin:4', //Add,
  //   //   object: 'object:13',
  //   //   target: 'test:124445566',
  //   //   time: null,
  //   //   context: { extra: 123 }
  //   // })
  //   // const result2 = await cassandraFeed.add(activity)
  //   // ;
  //   // const result3 = await cassandraFeed.getItem(0, 10)
  //   // ;
  //   // result3.forEach(element => {
  //   //   ;
  //   // });
  //   // .then(result => console.log('User with email %s', result));
  // })

  // // }, 12000)


  // const pool = getRedisConnection()
  // class User2Feed extends RedisFeed {
  //   keyFormat = (userId) => `feed:user:${userId}`
  // }

  // pool.on('ready', () => {

  //   debug('redis client is ready')
  //   console.log('redis client is ready');
  //   // const userFeed = new User2Feed(userId: 123 )// change to string later


  //   // const userRedisFeed = new RedisFeed( 123)

  //   // const activity = new Activity(
  //   //   'user:123',
  //   //   Add,
  //   //   'test:12',
  //   //   'object:13'
  //   // )

  //   // async function runAsync() {
  //   //   // # add into the global activity cache (if we are using it)
  //   //   const addedActivity = await User2Feed.insertActivity(activity) // static
  //   //   const result = await userRedisFeed.add(activity)
  //   //   const results1 = await userRedisFeed.getItem(0, 10)
  //   // }
  //   // runAsync()
  // })
