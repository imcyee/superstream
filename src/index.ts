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

class User2Feed extends RedisFeed {
  key_format = (user_id) => `feed:user:${user_id}`

}


pool.on('ready', () => {
  console.log('redis client is ready');
  // const userFeed = new UserBaseFeed({
  const userFeed = new User2Feed({
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
  
  async function runAsync() {
    // # add into the global activity cache (if we are using it)
    const addedActivity = await User2Feed.insert_activity(activity) // static
    console.log('addedActivity ', addedActivity);
    const result = await userRedisFeed.add(activity)
    console.log(result);

    const result1 = await userRedisFeed.get_item(0, 10)
    console.log('result1', result1);
    // console.log(result1);
  }
  runAsync()
})
