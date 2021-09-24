import { getRedisConnection } from "../connection"
import { RedisClientType } from "redis/dist/lib/client"

export class RedisCache {

  // The base for all redis data structures
  keyFormat = (s) => `redis:cache:${s}`
  key
  source
  _redis: RedisClientType

  redis_server: string

  constructor(
    key,
    redis = null,
    redis_server = 'default'
  ) {
    // write the key
    this.key = key
    // handy when using fallback to other data sources
    this.source = 'redis'
    // the redis connection, this.redis is lazy loading the connection
    this._redis = redis
    // the redis server (see getRedisConnection)
    this.redis_server = redis_server
  }

  getRedis() {
    // Only load the redis connection if we use it
    if (!this._redis) {
      this._redis = getRedisConnection(this.redis_server)
    }
    return this._redis
  }

  // Sets the redis connection
  set_redis(value) {
    this._redis = value
  }

  get redis(): RedisClientType {
    const redis = this.getRedis()
    return redis
  }
  set redis(value) { this.set_redis(value) }

  getKey() {
    return this.key
  }

  async delete() {
    const key = this.getKey()
    await this.redis.del(key)
    return
  }

  // If the redis connection is already in distributed state use it
  // Otherwise spawn a new distributed connection using .map
  async _pipeline_if_needed(operation, kwargs) {
    var results
    // const pipe_needed = !(this.redis instanceof BasePipeline)
    // if (pipe_needed) {
    //   const pipe = this.redis.pipeline(transaction = false)
    //   operation(pipe, kwargs)
    //   results = pipe.execute()
    // } else { 
    results = await operation(this.redis, kwargs)
    // }
    return results
  }
}
 