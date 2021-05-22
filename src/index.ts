import { UserBaseFeed } from "./feeds/base";
import { get_redis_connection, setup_redis } from "./storage/redis/connection";

const pool = setup_redis()
// console.log(pool);
const redisConnection = get_redis_connection()
console.log(redisConnection);
console.log('hello world');

pool.on('ready', () => {
  console.log('redis client is ready');
})


const userFeed = new UserBaseFeed({
  user_id: 123 // change to string later
})

console.log(userFeed);