import { RedisClientType } from "redis"
import { getRedisConnection } from "../connection"

type RedisKey = string

export class RedisCache {

  // The base for all redis data structures
  keyFormat = (s) => `redis:cache:${s}`

  /** Redis key */
  key: RedisKey

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

  getKey() {
    return this.key
  }

  getRedis() {
    // Only load the redis connection if we use it
    if (!this._redis)
      this._redis = getRedisConnection(this.redis_server)

    return this._redis
  }

  get redis(): RedisClientType {
    const redis = this.getRedis()
    return redis
  }

  set redis(value) {
    this._redis = value
  }

  async delete() {
    const key = this.getKey()
    await this.redis.del(key)
    return
  }
}
