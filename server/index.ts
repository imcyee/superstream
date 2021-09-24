import * as cassandra from 'cassandra-driver';
import express from 'express';
import { getRedisConnection } from "../src/storage/redis/connection";
import { RedisFeed } from "../src/feeds/RedisFeed";
import routes from "../src/routes";
import { SimpleTimelineSerializer } from "../src/serializers/SimpleTimelineSerializer";
import { CassandraTimelineStorage } from "../src/storage/cassandra/CassandraTimelineStorage";
import { getClient } from "../src/storage/cassandra/connection";

import createDebug from 'debug'

const debug = createDebug('server')

const app = express()
// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

app.use('/v1', routes)
const port = 8080
app.listen(port, () => {
  console.info(`Listening to port ${port}`);
});
const Mapper = cassandra.mapping.Mapper;
const Client = cassandra.Client
const UnderscoreCqlToCamelCaseMappings = cassandra.mapping.UnderscoreCqlToCamelCaseMappings;

const client = getClient()

client.connect().then(async () => {

  const cassandra = new CassandraTimelineStorage({
    SerializerClass: SimpleTimelineSerializer,
    column_family_name: "feeds"
  })

  // cassandra.trim('feed_uuuusrrrrr:123', 10)
  // // // runCassandraMigration()
  // const cassandraFeed = new CassandraFeed( 'user:123' )

  // const activity = new Activity({
  //   actor: 'user:123',
  //   verb: 'pin:4', //Add,
  //   object: 'object:13',
  //   target: 'test:124445566',
  //   time: null,
  //   extraContext: { extra: 123 }
  // })
  // const result2 = await cassandraFeed.add(activity)
  // ;
  // const result3 = await cassandraFeed.getItem(0, 10)
  // ;
  // result3.forEach(element => {
  //   ;
  // });
  // .then(result => console.log('User with email %s', result));
})

// }, 12000)

const pool = getRedisConnection()
class User2Feed extends RedisFeed {
  keyFormat = (userId) => `feed:user:${userId}`
}

pool.on('ready', () => {

  debug('redis client is ready')
  console.log('redis client is ready');
  // const userFeed = new User2Feed(userId: 123 )// change to string later


  // const userRedisFeed = new RedisFeed( 123)

  // const activity = new Activity(
  //   'user:123',
  //   Add,
  //   'test:12',
  //   'object:13'
  // )

  // async function runAsync() {
  //   // # add into the global activity cache (if we are using it)
  //   const addedActivity = await User2Feed.insertActivity(activity) // static
  //   const result = await userRedisFeed.add(activity)
  //   const results1 = await userRedisFeed.getItem(0, 10)
  // }
  // runAsync()
})
