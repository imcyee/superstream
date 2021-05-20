import { NotImplementedError } from "../../../errors"
import { RedisCache } from "./base"

export class BaseRedisHashCache extends RedisCache {
  key_format = 'redis:base_hash_cache:%s'
}

export class RedisHashCache extends BaseRedisHashCache {
  key_format = 'redis:hash_cache:%s'

  get_key() {
    return this.key
  }
  count() {
    // '''
    // Returns the number of elements in the sorted set
    // '''
    const key = this.get_key()
    const redis_result = this.redis.hlen(key)
    const redis_count = parseInt(redis_result)
    return redis_count
  }
  contains(field) {
    // '''
    // Uses hexists to see if the given field is present
    // '''
    const key = this.get_key()
    const result = this.redis.hexists(key, field)
    const activity_found = !!(result)
    return activity_found
  }
  get(field) {
    const fields = [field]
    const results = this.get_many(fields)
    const result = results[field]
    return result
  }
  keys() {
    const key = this.get_key()
    const keys = this.redis.hkeys(key)
    return keys
  }
  delete_many(fields) {
    var results = {}

    function _delete_many(redis, fields) {
      for (const field of fields) {
        const key = this.get_key(field)
        logger.debug('removing field %s from %s', field, key)
        const result = redis.hdel(key, field)
        results[field] = result
      }
      return results
    }
    // # start a new map redis or go with the given one
    results = this._pipeline_if_needed(_delete_many, fields)

    return results
  }
  get_many(fields) {
    const key = this.get_key()
    const results = {}
    const values = list(this.redis.hmget(key, fields))
    for (field, result in zip(fields, values)) {
      logger.debug('getting field %s from %s', field, key)
      results[field] = result
    }
    return results
  }
  set(key, value) {
    const key_value_pairs = [(key, value)]
    const results = this.set_many(key_value_pairs)
    const result = results[0]
    return result
  }
  set_many(key_value_pairs) {
    var results = []

    function _set_many(redis, key_value_pairs) {
      for (const a of key_value_pairs) {
        const [field, value] = a
        const key = this.get_key(field)
        logger.debug(
          'writing hash(%s) field %s to %s', key, field, value)
        const result = redis.hmset(key, { field: value })
        results.push(result)
      }
      return results
    }
    // # start a new map redis or go with the given one
    results = this._pipeline_if_needed(_set_many, key_value_pairs)

    return results
  }
}
export class FallbackHashCache extends RedisHashCache {

  // '''
  // Redis structure with fallback to the database
  // '''
  key_format = 'redis:db_hash_cache:%s'

  get_many(fields, database_fallback = true) {
    var results = {}

    function _get_many(redis, fields) {
      for (const field of fields) {
        // # allow for easy sharding
        const key = this.get_key(field)
        logger.debug('getting field %s from %s', field, key)
        const result = redis.hget(key, field)
        results[field] = result
      }
      return results
    }
    // # start a new map redis or go with the given one
    results = this._pipeline_if_needed(_get_many, fields)
    results = dict(zip(fields, results))

    // # query missing results from the database && store them
    if (database_fallback) {
      const missing_keys = [f for f in fields if not results[f]]
      const database_results = this.get_many_from_fallback(missing_keys)
      // # update our results with the data from the db && send them to
      // # redis
      results.update(database_results)
      this.set_many(database_results.items())
    }
    return results
  }
  get_many_from_fallback(missing_keys) {
    // '''
    // Return a dictionary with the serialized values for the missing keys
    // '''
    throw new NotImplementedError('Please implement this')
  }
}

export class ShardedHashCache extends RedisHashCache {

  // '''
  // Use multiple keys instead of one so its easier to shard across redis machines
  // '''
  number_of_keys = 10

  get_keys() {
    // '''
    // Returns all possible keys
    // '''
    const keys = []
    for (x in range(this.number_of_keys)) {
      const key = this.key + ':%s' % x
      keys.append(key)
    }
    return keys
  }
  get_key(field) {
    // '''
    // Takes something like
    // field="3,79159750" && returns 7 as the index
    // '''
    // import hashlib
    // # redis treats everything like strings
    const field = str(field).encode('utf-8')
    const number = int(hashlib.md5(field).hexdigest(), 16)
    const position = number % this.number_of_keys
    return this.key + ':%s' % position
  }

  get_many(fields) {
    var results = {}

    function _get_many(redis, fields) {
      for (field in fields) {
        // # allow for easy sharding
        const key = this.get_key(field)
        logger.debug('getting field %s from %s', field, key)
        const result = redis.hget(key, field)
        results[field] = result
      }
      return results
    }
    // # start a new map redis or go with the given one
    results = this._pipeline_if_needed(_get_many, fields)
    results = dict(zip(fields, results))

    return results
  }
  delete_many(fields) {
    var results = {}

    function _get_many(redis, fields) {
      for (field in fields) {
        // # allow for easy sharding
        const key = this.get_key(field)
        logger.debug('getting field %s from %s', field, key)
        const result = redis.hdel(key, field)
        results[field] = result
      }
      return results
    }
    // # start a new map redis or go with the given one
    results = this._pipeline_if_needed(_get_many, fields)
    results = dict(zip(fields, results))
    // # results = dict((k, v) for k, v in results.items() if v)

    return results
  }
  count() {
    // '''
    // Returns the number of elements in the sorted set
    // '''
    logger.warn('counting all keys is slow && should be used sparsely')
    const keys = this.get_keys()
    const total = 0
    for (key in keys) {
      redis_result = this.redis.hlen(key)
      redis_count = int(redis_result)
      total += redis_count
    }
    return total
  }
  contains(field) {
    throw new NotImplementedError(
      'contains isnt implemented for ShardedHashCache')
  }
  delete() {
    // '''
    // Delete all the base variations of the key
    // '''
    logger.warn('deleting all keys is slow && should be used sparsely')
    const keys = this.get_keys()

    for (key in keys) {
      // # TODO, batch this, but since we barely do this
      // # not too important
      this.redis.delete(key)
    }
  }
  keys() {
    // '''
    // list all the keys, very slow, don't use too often
    // '''
    logger.warn('listing all keys is slow && should be used sparsely')
     const keys = this.get_keys()
     var fields = []
    for (key in keys) {
      const  more_fields = this.redis.hkeys(key)
      fields += more_fields
    }
    return fields
  }
}
export class ShardedDatabaseFallbackHashCache extends ShardedHashCache, FallbackHashCache {
  pass
}