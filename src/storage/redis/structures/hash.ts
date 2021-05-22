import { NotImplementedError } from "../../../errors"
import { RedisCache } from "./base"
import { promisify } from 'util'
import { RedisClient } from "redis"
import { dictZip, zip } from "../../../utils"
import range from 'lodash/range'
import merge from 'lodash/merge'
import toPairs from 'lodash/toPairs'
import * as crypto from 'crypto'


const md5sum = crypto.createHash('md5');

export class BaseRedisHashCache extends RedisCache {
  key_format = 'redis:base_hash_cache:%s'
}

export class RedisHashCache extends BaseRedisHashCache {
  key_format = 'redis:hash_cache:%s'

  get_key(field?: string) {
    return this.key
  }

  async count() {
    // '''
    // Returns the number of elements in the sorted set
    // '''
    const key = this.get_key()
    const redis_result = await promisify(this.redis.hlen)(key)
    const redis_count = Number(redis_result)
    return redis_count
  }

  async contains(field) {
    // '''
    // Uses hexists to see if the given field is present
    // '''
    const key = this.get_key()
    const result = await promisify(this.redis.hexists)(key, field)
    const activity_found = !!(result)
    return activity_found
  }

  async get(field) {
    const fields = [field]
    const results = await this.get_many(fields)
    const result = results[field]
    return result
  }

  async keys() {
    const key = this.get_key()
    const keys = await promisify(this.redis.hkeys)(key)
    return keys
  }

  async delete_many(fields) {
    var results = {}

    async function _delete_many(redis, fields) {
      for (const field of fields) {
        const key = this.get_key(field)
        // logger.debug('removing field %s from %s', field, key)
        const result = await promisify(redis.hdel)(key, field)
        results[field] = result
      }
      return results
    }
    // # start a new map redis or go with the given one
    results = await this._pipeline_if_needed(_delete_many, fields)

    return results
  }

  async get_many(fields) {
    const key = this.get_key()
    const results = {}
    const values = await promisify(this.redis.hmget as any)(key, fields)
    for (const zipped of zip(fields, values)) {
      const [field, result] = zipped
      // logger.debug('getting field %s from %s', field, key)
      results[field] = result
    }
    return results
  }

  set(key, value) {
    const key_value_pairs = [[key, value]]
    const results = this.set_many(key_value_pairs)
    const result = results[0]
    return result
  }

  async set_many(key_value_pairs) {
    var results = []

    async function _set_many(redis, key_value_pairs) {
      for (const a of key_value_pairs) {
        const [field, value] = a
        const key = this.get_key(field)
        // logger.debug(
        // 'writing hash(%s) field %s to %s', key, field, value)
        const result = await promisify(redis.hmset)(key, { field: value })
        results.push(result)
      }
      return results
    }
    // # start a new map redis or go with the given one
    results = await this._pipeline_if_needed(_set_many, key_value_pairs)

    return results
  }
}

export class FallbackHashCache extends RedisHashCache {

  // '''
  // Redis structure with fallback to the database
  // '''
  key_format = 'redis:db_hash_cache:%s'

  async get_many(fields, database_fallback = true) {
    var results = {}

    async function _get_many(redis, fields) {
      for (const field of fields) {
        // # allow for easy sharding
        const key = this.get_key(field)
        // logger.debug('getting field %s from %s', field, key)
        const result = await promisify(redis.hget)(key, field)
        results[field] = result
      }
      return results
    }
    // # start a new map redis or go with the given one
    results = await this._pipeline_if_needed(_get_many, fields)
    results = zip(fields, results)

    // # query missing results from the database && store them
    if (database_fallback) {
      var missing_keys = []
      for (const f of fields) {
        missing_keys.push(f || results[f])
      }
      // const missing_keys = [f for f of fields if not results[f]]
      const database_results = this.get_many_from_fallback(missing_keys)
      // # update our results with the data from the db && send them to
      // # redis
      results = merge(results, database_results)
      // results.update(database_results)
      this.set_many(toPairs(database_results))
    }
    return results
  }
  async get_many_from_fallback(missing_keys) {
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
    for (const x of range(this.number_of_keys)) {
      const key = `${this.key}:${x}`
      keys.push(key)
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
    field = field.toString() // .encode('utf-8')
    const number = parseInt(md5sum.digest(field), 16)
    const position = number % this.number_of_keys
    return `this.key:${position}`
  }

  async get_many(fields) {
    var results = {}

    async function _get_many(redis, fields) {
      for (const field of fields) {
        // # allow for easy sharding
        const key = this.get_key(field)
        // logger.debug('getting field %s from %s', field, key)
        const result = await promisify(redis.hget)(key, field)
        results[field] = result
      }
      return results
    }
    // # start a new map redis or go with the given one
    results = await this._pipeline_if_needed(_get_many, fields)
    results = dictZip(zip(fields, results))

    return results
  }

  async delete_many(fields) {
    var results = {}

    async function _get_many(redis: RedisClient, fields) {
      for (const field of fields) {
        // # allow for easy sharding
        const key = this.get_key(field)
        // logger.debug('getting field %s from %s', field, key)
        const result = await promisify(redis.hdel as any)(key, field)
        results[field] = result
      }
      return results
    }
    // # start a new map redis or go with the given one
    results = await this._pipeline_if_needed(_get_many, fields)
    results = dictZip(zip(fields, results))
    // # results = dict((k, v) for k, v in results.items() if v)

    return results
  }

  async count() {
    // '''
    // Returns the number of elements in the sorted set
    // '''
    // logger.warn('counting all keys is slow && should be used sparsely')
    const keys = this.get_keys()
    var total = 0
    for (const key of keys) {
      const redis_result = await promisify(this.redis.hlen)(key)
      const redis_count = Number(redis_result)
      total += redis_count
    }
    return total
  }

  async contains(field): Promise<boolean> {
    throw new NotImplementedError(
      'contains isnt implemented for ShardedHashCache')
  }

  async delete() {
    // '''
    // Delete all the base variations of the key
    // '''
    // logger.warn('deleting all keys is slow && should be used sparsely')
    const keys = this.get_keys()

    for await (const key of keys) {
      // # TODO, batch this, but since we barely do this
      // # not too important 

      await promisify(this.redis.del as any)(key)
    }
  }

  async keys() {
    // '''
    // list all the keys, very slow, don't use too often
    // '''
    // logger.warn('listing all keys is slow && should be used sparsely')
    const keys = this.get_keys()
    var fields = []
    for (const key of keys) {
      const more_fields = await promisify(this.redis.hkeys)(key)
      // fields += more_fields
      fields.push(more_fields)
    }
    return fields
  }
}

// export class ShardedDatabaseFallbackHashCache extends ShardedHashCache, FallbackHashCache {}

// interface ShardedDatabaseFallbackHashCache extends ShardedHashCache, FallbackHashCache { }
// // Apply the mixins into the base class via
// // the JS at runtime
// applyMixins(ShardedDatabaseFallbackHashCache, [ShardedHashCache, FallbackHashCache]);

// // This can live anywhere in your codebase:
// function applyMixins(derivedCtor: any, constructors: any[]) {
//   constructors.forEach((baseCtor) => {
//     Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
//       Object.defineProperty(
//         derivedCtor.prototype,
//         name,
//         Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
//         Object.create(null)
//       );
//     });
//   });
// }