import { Activity } from "../src/activity";
import { UserBaseFeed } from "../src/feeds/base";
import { RedisFeed } from "../src/feeds/redis";
import { get_redis_connection, setup_redis } from "../src/storage/redis/connection";
import { Add } from "../src/verbs/base";
import * as cassandra from 'cassandra-driver'
import { getClient, setup_connection } from "./storage/cassandra/connection";

const Mapper = cassandra.mapping.Mapper;
const Client = cassandra.Client
const UnderscoreCqlToCamelCaseMappings = cassandra.mapping.UnderscoreCqlToCamelCaseMappings;
// setTimeout(() => {
const client = getClient()

const query = 'SELECT actor FROM stream.feeds WHERE feed_id = ?';

client.execute(query, ["123"])
  .then(result => console.log('User with email %s', result));
// }, 12000)




const pool = get_redis_connection()
class User2Feed extends RedisFeed {
  key_format = (user_id) => `feed:user:${user_id}`
}

pool.on('ready', () => {
  console.log('redis client is ready');
  const userFeed = new User2Feed({
    user_id: 123 // change to string later
  })

  const userRedisFeed = new RedisFeed({
    user_id: 123
  })

  const activity = new Activity(
    'user:123',
    Add,
    'test:12',
    'object:13'
  )

  async function runAsync() {
    // # add into the global activity cache (if we are using it)
    const addedActivity = await User2Feed.insert_activity(activity) // static
    const result = await userRedisFeed.add(activity)
    const results1 = await userRedisFeed.get_item(0, 10)
  }
  runAsync()
})

