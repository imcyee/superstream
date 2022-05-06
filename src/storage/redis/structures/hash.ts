import { NotImplementedError } from "../../../errors"
import { RedisCache } from "./base"
import { promisify } from 'util'
import { dictZip, parseBigInt, zip } from "../../../utils"
import range from 'lodash/range'
import merge from 'lodash/merge'
import toPairs from 'lodash/toPairs'
import * as crypto from 'crypto'
import createDebug from 'debug'

const debug = createDebug('ns:debug')


export class BaseRedisHashCache extends RedisCache {
  keyFormat = (s) => `redis:base_hash_cache:${s}`
}

export class RedisHashCache extends BaseRedisHashCache {
  keyFormat = (s) => `redis:hash_cache:${s}`

  getKey(field?: string) {
    return this.key
  }

  // Returns the number of elements in the sorted set
  async count() {
    const key = this.getKey()
    const redis_result = await this.redis.hLen(key)
    const redis_count = Number(redis_result)
    return redis_count
  }

  // Uses hexists to see if the given field is present
  async contains(field) {
    const key = this.getKey()
    const result = await this.redis.hExists(key, field)
    const activity_found = !!(result)
    return activity_found
  }

  async get(field) {
    const fields = [field]
    const results = await this.getMany(fields)
    const result = results[field]
    return result
  }

  async keys() {
    const key = this.getKey()
    const keys = await this.redis.hKeys(key)
    return keys
  }

  async deleteMany(fields) {
    var results = {}
    for (const field of fields) {
      const key = this.getKey(field)
      debug(`removing field ${field} from ${key}`)
      const result = await promisify(this.redis.hDel)(key, field)
      results[field] = result
    }
    return results
  }

  async getMany(fields) {
    const key = this.getKey()
    const results = {}
    const values = await this.redis.hmGet(key, fields)
    for (const zipped of zip(fields, values)) {
      const [field, result] = zipped
      debug(`getting field ${field} from ${key}`)
      results[field as any] = result
    }
    return results
  }

  set(key, value) {
    const key_value_pairs = [[key, value]]
    const results = this.setMany(key_value_pairs)
    const result = results[0]
    return result
  }

  async setMany(key_value_pairs) {
    var results = []
    for (const a of key_value_pairs) {
      const [field, value] = a
      const key = this.getKey(field)
      debug(`writing hash(${key}) field ${field} to ${value}`)
      const result = await this.redis.hSet(key, { [field]: value })
      results.push(result)
    }
    return results
  }
}

export class FallbackHashCache extends RedisHashCache {

  // Redis structure with fallback to the database
  keyFormat = (s) => `redis:db_hash_cache:${s}`

  async getMany(fields, database_fallback = true) {
    var results = {}

    for (const field of fields) {
      // # allow for easy sharding
      const key = this.getKey(field)
      debug(`getting field ${field} from ${key}`)
      const result = await promisify(this.redis.hGet)(key, field)
      results[field] = result
    }

    results = zip(fields, Object.values(results))

    // # query missing results from the database && store them
    if (database_fallback) {
      const missing_keys = fields.filter((f) => (!results[f]))
      const database_results = this.get_many_from_fallback(missing_keys)
      // # update our results with the data from the db && send them to
      // # redis
      results = merge(results, database_results)
      // results.update(database_results)
      this.setMany(toPairs(database_results))
    }
    return results
  }

  // Return a dictionary with the serialized values for the missing keys
  async get_many_from_fallback(missing_keys) {
    throw new NotImplementedError('Please implement this')
  }
}


export class ShardedHashCache extends RedisHashCache {

  // Use multiple keys instead of one so its easier to shard across redis machines
  number_of_keys = 10

  // Returns all possible keys
  getKeys() {
    const keys = []
    for (const x of range(this.number_of_keys)) {
      const key = `${this.key}:${x}`
      keys.push(key)
    }
    return keys
  }

  getKey(field) {

    // Takes something like
    // field="3,79159750" && returns 7 as the index

    // import hashlib
    // # redis treats everything like strings 
    field = field.toString() // .encode('utf-8') 
    const md5sumDigested = crypto.createHash('md5')
      .update(field)
      .digest("hex");
    const number = parseBigInt(md5sumDigested.toString(), 16)
    const position = Number(number % BigInt(this.number_of_keys))
    return `${this.key}:${position}`
  }

  async getMany(fields) {
    var results = {}
    for await (const field of fields) {
      // # allow for easy sharding
      const key = this.getKey(field)
      debug(`getting field ${field} from ${key}`)
      const result = await this.redis.hGet(key, field)
      results[field] = result
    }
    results = dictZip(zip(fields, Object.values(results)))
    return results
  }


  async deleteMany(fields) {
    var results = {}

    for (const field of fields) {
      // # allow for easy sharding
      const key = this.getKey(field)
      debug(`getting field ${field} from ${key}`)
      const result = await this.redis.hDel(key, field)
      results[field] = result
    }
    results = dictZip(zip(fields, Object.values(results)))
    return results
  }

  // Returns the number of elements in the sorted set
  async count() {
    const keys = this.getKeys()
    var total = 0
    for (const key of keys) {
      const redis_result = await this.redis.hLen(key)
      const redis_count = Number(redis_result)
      total += redis_count
    }
    return total
  }

  async contains(field): Promise<boolean> {
    throw new NotImplementedError('contains isnt implemented for ShardedHashCache')
  }

  async delete() {
    // Delete all the base variations of the key 
    console.warn('deleting all keys is slow && should be used sparsely');
    const keys = this.getKeys()
    for await (const key of keys) {
      // # TODO, batch this, but since we barely do this
      // # not too important  
      await this.redis.del(key)
    }
  }

  async keys() {
    // list all the keys, very slow, don't use too often
    console.warn('listing all keys is slow && should be used sparsely')
    const keys = this.getKeys()
    var fields = []
    for (const key of keys) {
      const more_fields = await this.redis.hKeys(key)
      fields.push(more_fields)
    }
    return fields
  }
}
 