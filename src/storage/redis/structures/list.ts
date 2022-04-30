import { AssertionError } from "../../../errors"
import { RedisCache } from "./base"
import { promisify } from 'util'
import createDebug from 'debug'

const debug = createDebug('ns:debug:list')

// '''
// Generic list functionality used for both the sorted set && list implementations
// Retrieve the sorted list/sorted set by using python slicing
// '''
export abstract class BaseRedisListCache extends RedisCache {

  keyFormat = (s) => `redis:base_list_cache:${s}`
  maxLength = 100

  // """
  // Retrieves an item or slice from the set of results.
  // """
  async getitem(
    start: number = 0,
    stop?: number,
    step?: number
  ) {

    if (!start && !stop)
      throw new TypeError()

    if ((start < 0) || (stop < 0))
      throw new AssertionError("Negative indexing is not supported.")

    // assert((not isinstance(k, slice) && (k >= 0)) || (isinstance(k, slice) && (k.start is null or k.start >= 0)
    //     && (k.stop is null or k.stop >= 0))), \
    // "Negative indexing is not supported."

    // var start
    var bound = start + 1

    if (stop) {
      bound = Number(stop)
    }

    // start = start || 0
    if (start && bound && (start == bound)) {
      return []
    }

    // # We need check to see if we need to populate more of the cache.
    var results
    try {
      console.log('getting error soon');
      results = await this.getResults(start, bound)
    } catch (err) {
      // except StopIteration:
      // # There's nothing left, even though the bound is higher.
      results = null
    }
    return results
  }

  abstract getResults(start, stop): Promise<string[]> // { throw new NotImplementedError('please define this function in subclasses') }
}

export class RedisListCache extends BaseRedisListCache {
  keyFormat = (s) => `redis:list_cache:${s}`
  // #: the maximum number of items the list stores
  max_items = 1000
  _filtered

  async getResults(start, stop) {
    if (start)
      start = 0

    if (stop)
      stop = -1

    const key = this.getKey()
    const results = await this.redis.lRange(key, start, stop)
    return results
  }

  async append(value) {
    const values = [value]
    const results = await this.append_many(values)
    const result = results[0]
    return result
  }

  async append_many(values) {
    const key = this.getKey()
    var results = []
    for (const value of values) {
      debug(`adding to ${key} with value ${value}`)
      const result = await (promisify(this.redis.rPush).bind(this.redis))(key, value)
      results.push(result)
    }
    return results
  }

  async remove(value) {
    const values = [value]
    const results = await this.removeMany(values)
    const result = results[0]
    return result
  }

  async removeMany(values) {
    const key = this.getKey()
    var results = []
    for await (const value of values) {
      debug(`removing from ${key} with value ${value}`)
      const result = await (promisify(this.redis.lRem).bind(this))(key, 10, value)
      results.push(result)
    }
    return results
  }

  async count() {
    const key = this.getKey()
    const count = await this.redis.lLen(key)
    return count
  }

  // '''
  // Removes the old items in the list
  // '''
  async trim() {
    // # clean up everything with a rank lower than max items up to the end of
    // # the list
    const key = this.getKey()
    const removed = await this.redis.lTrim(key, 0, this.max_items - 1)
    const msg_format = 'cleaning up the list ${} to a max of ${} items'
    console.info(msg_format, this.getKey(), this.max_items)
    return removed
  }
}

export abstract class FallbackRedisListCache extends RedisListCache {

  // '''
  // Redis list cache which after retrieving all items from redis falls back
  // to a main data source (like the database)
  // '''
  keyFormat = s => `redis:db_list_cache:${s}`

  abstract get_fallback_results(start, stop)
  //  {
  //   throw new NotImplementedError('please define this function in subclasses')
  // }

  // '''
  // Retrieves results from redis && the fallback datasource
  // '''
  async getResults(start, stop) {
    var redis_results
    var results
    if (stop) {
      redis_results = await this.get_redis_results(start, stop - 1)
      const required_items = stop - start
      var enough_results = redis_results.length == required_items
      if (!(redis_results <= required_items))
        throw new Error(`we should never have more than we ask for, start ${start}, stop ${stop}`)

    } else {
      // # [start:] slicing does not know what's enough so
      // # does not hit the db unless the cache is empty
      redis_results = await this.get_redis_results(start, stop)
      enough_results = true
    }

    if (!redis_results || !enough_results) {
      this.source = 'fallback'
      const filtered = this._filtered || false // getattr("_filtered", false)
      const db_results = await this.get_fallback_results(start, stop)

      if (start == 0 && !redis_results && !filtered) {
        console.info(`setting cache for type ${this.getKey()} with len ${db_results.length}`)
        // # only cache when we have no results, to prevent duplicates
        await this.cache(db_results)
      } else if (start == 0 && redis_results && !filtered) {
        console.info(`overwriting cache for type ${this.getKey()} with len ${db_results.length}`)
        // # clear the cache && add these values
        await this.overwrite(db_results)
      }
      results = db_results
      console.info(`retrieved ${start} to ${stop} from db && not from cache with key ${this.getKey()}`)
    } else {
      results = redis_results
      console.info(`retrieved ${start} to ${stop} from cache on key ${this.getKey()}`)
    }
    return results
  }

  // '''
  // Returns the results from redis
  // :param start: the beginning
  // :param stop: the end
  // '''
  async get_redis_results(start, stop) {
    const results = await super.getResults(start, stop)
    return results
  }

  // '''
  // Hook to write the results from the fallback to redis
  // '''
  async cache(fallback_results) {
    await this.append_many(fallback_results)
  }

  // '''
  // Clear the cache && write the results from the fallback
  // '''
  async overwrite(fallback_results) {
    await this.delete()
    await this.cache(fallback_results)
  }
}