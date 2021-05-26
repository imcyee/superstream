import { get_redis_connection } from "../connection"
import * as redis from 'redis'
import { promisify } from 'util'

export class RedisCache {

  // '''
  // The base for all redis data structures
  // '''
  key_format = 'redis:cache:%s'
  key
  source
  _redis: redis.RedisClient

  redis_server: string

  constructor(
    key,
    redis = null,
    redis_server = 'default'
  ) {
    // # write the key
    this.key = key
    // # handy when using fallback to other data sources
    this.source = 'redis'
    // # the redis connection, this.redis is lazy loading the connection
    this._redis = redis
    // # the redis server (see get_redis_connection)
    this.redis_server = redis_server
  }

  // delAsync
  // getAsync

  get_redis() {
    // '''
    // Only load the redis connection if we use it
    // '''
    if (!this._redis) {
      this._redis = get_redis_connection(this.redis_server)
      // this.getAsync = promisify(this._redis.get).bind(this._redis);
      // this.delAsync = promisify(this._redis.del).bind(this._redis);

    }
    return this._redis
  }

  set_redis(value) {
    // '''
    // Sets the redis connection
    // '''
    this._redis = value
  }

  // redis = property(get_redis, set_redis)
  get redis(): redis.RedisClient {
    const redis = this.get_redis() 
    return redis
  }
  set redis(value) { this.set_redis(value) }

  get_key() {
    return this.key
  }

  async delete() {
    const key = this.get_key()
    return await new Promise((resolve, reject) => {
      this.redis.del(key, (err, reply) => {
        if (err)
          reject(err)
        return resolve(reply)
      })
    })
  }

  async _pipeline_if_needed(operation, kwargs) {
    // '''
    // If the redis connection is already in distributed state use it
    // Otherwise spawn a new distributed connection using .map
    // '''
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