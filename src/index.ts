import { Activity } from "./activity";
import { UserBaseFeed } from "./feeds/base";
import { RedisFeed } from "./feeds/redis";
import { get_redis_connection, setup_redis } from "./storage/redis/connection";
import { Add } from "./verbs/base";

const pool = get_redis_connection()
// console.log(pool);
// const redisConnection = get_redis_connection()
// console.log(redisConnection);
console.log('hello world');

pool.on('ready', () => {
  console.log('redis client is ready');
  const userFeed = new UserBaseFeed({
    user_id: 123 // change to string later
  })

  const userRedisFeed = new RedisFeed({
    user_id: 123
  })

  const activity = new Activity(
    123,
    Add,
    12
  )
  // console.log(activity);
  async function runAsync() {

    const addedActivity = await userFeed.add(activity)
    console.log(addedActivity);

    const result1 = await userRedisFeed.get_item(0, 10)
    console.log(result1);
    // const result = await userRedisFeed.add(activity)
    // console.log(result);
  }
  runAsync()
})
