import { Activity } from "../src/activity";
import { UserBaseFeed } from "../src/feeds/base";
import { RedisFeed } from "../src/feeds/redis";
import { get_redis_connection, setup_redis } from "../src/storage/redis/connection";
import { Add } from "../src/verbs/base";
import * as cassandra from 'cassandra-driver'
import { getClient, setup_connection } from "./storage/cassandra/connection";
import { CassandraFeed } from "./feeds/cassandra";
import { runCassandraMigration } from "./storage/cassandra/cassandra_migration";

const Mapper = cassandra.mapping.Mapper;
const Client = cassandra.Client
const UnderscoreCqlToCamelCaseMappings = cassandra.mapping.UnderscoreCqlToCamelCaseMappings;

// runCassandraMigration()
// setTimeout(() => {
const client = getClient()


client.connect().then(async () => {
  const query = 'SELECT * FROM stream.feeds WHERE feed_id = ?';
  const result1 = await client.execute(query, ["123"])
  console.log('result1', result1);
  console.log(result1.rows);

  const cassandraFeed = new CassandraFeed({ user_id: 'user:123' })

  const activity = new Activity(
    'user:123',
    Add,
    'test:124445566',
    'object:13'
  )
  const result2 = await cassandraFeed.add(activity)
  const result3 = await cassandraFeed.get_item(0, 10)
  result3.forEach(element => {
    console.log(element.serialization_id);
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
 