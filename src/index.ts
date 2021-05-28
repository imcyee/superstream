import { Activity } from "../src/activity";
import { UserBaseFeed } from "../src/feeds/base";
import { RedisFeed } from "../src/feeds/redis";
import { get_redis_connection, setup_redis } from "../src/storage/redis/connection";
import { Add } from "../src/verbs/base";
import * as cassandra from 'cassandra-driver'
import { getClient, setup_connection } from "./storage/cassandra/connection";
import { CassandraFeed } from "./feeds/cassandra";
import { runCassandraMigration } from "./storage/cassandra/cassandra_migration";
import express from 'express'
import routes from "./routes";

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
  // runCassandraMigration()
  const cassandraFeed = new CassandraFeed({ user_id: 'user:123' })

  const activity = new Activity({
    actor: 'user:123',
    verb: 'pin:4', //Add,
    object: 'object:13',
    target: 'test:124445566',
    time: null,
    extra_context: { extra: 123 }
  })
  const result2 = await cassandraFeed.add(activity)
  const result3 = await cassandraFeed.get_item(0, 10)
  result3.forEach(element => {
    console.log(element);
  });
  // .then(result => console.log('User with email %s', result));
})

// }, 12000)

const pool = get_redis_connection()
class User2Feed extends RedisFeed {
  key_format = (user_id) => `feed:user:${user_id}`
}

pool.on('ready', () => {
  console.log('redis client is ready');
  // const userFeed = new User2Feed({
  //   user_id: 123 // change to string later
  // })

  // const userRedisFeed = new RedisFeed({
  //   user_id: 123
  // })

  // const activity = new Activity(
  //   'user:123',
  //   Add,
  //   'test:12',
  //   'object:13'
  // )

  // async function runAsync() {
  //   // # add into the global activity cache (if we are using it)
  //   const addedActivity = await User2Feed.insert_activity(activity) // static
  //   const result = await userRedisFeed.add(activity)
  //   const results1 = await userRedisFeed.get_item(0, 10)
  // }
  // runAsync()
})
