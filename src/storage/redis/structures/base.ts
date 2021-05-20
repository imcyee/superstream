import { get_redis_connection } from "../connection"

export class RedisCache {

  // '''
  // The base for all redis data structures
  // '''
  key_format = 'redis:cache:%s'
  key
  source
  _redis
  redis_server

  constructor(key, redis = null, redis_server = 'default') {
    // # write the key
    this.key = key
    // # handy when using fallback to other data sources
    this.source = 'redis'
    // # the redis connection, this.redis is lazy loading the connection
    this._redis = redis
    // # the redis server (see get_redis_connection)
    this.redis_server = redis_server
  }
  get_redis() {
    // '''
    // Only load the redis connection if we use it
    // '''
    if (!this._redis) {
      this._redis = get_redis_connection(
        server_name = this.redis_server
      )
    }
    return this._redis
  }

  set_redis(value) {
    // '''
    // Sets the redis connection
    // '''
    this._redis = value
  }

  redis = property(get_redis, set_redis)

  get_key() {
    return this.key
  }
  delete() {
    const key = this.get_key()
    this.redis.delete(key)
  }
  _pipeline_if_needed(operation, kwargs) {
    // '''
    // If the redis connection is already in distributed state use it
    // Otherwise spawn a new distributed connection using .map
    // '''
    var results
    const pipe_needed = !(this.redis instanceof BasePipeline)
    if (pipe_needed) {
      const pipe = this.redis.pipeline(transaction = false)
      operation(pipe, kwargs)
      results = pipe.execute()
    } else {
      results = operation(this.redis, kwargs)
    }
    return results
  }
}