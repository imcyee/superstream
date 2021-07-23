import { AssertionError, NotImplementedError } from "../../../errors"
import { RedisCache } from "./base"
import { promisify } from 'util'

interface Test {
  getResults(): []
}

export class BaseRedisListCache extends RedisCache {

  // '''
  // Generic list functionality used for both the sorted set && list implementations

  // Retrieve the sorted list/sorted set by using python slicing
  // '''
  keyFormat = (s) => `redis:base_list_cache:${s}`
  maxLength = 100

  // __getitem__(
  //   k
  // ) {
  //   // """
  //   // Retrieves an item or slice from the set of results.
  //   // This is the complicated stuff which allows us to slice
  //   // """
  //   if (not isinstance(k, (slice, six.integer_types))) {
  //     throw new TypeError
  //   }
  //   assert((not isinstance(k, slice) && (k >= 0))
  //   or(isinstance(k, slice) && (k.start is null or k.start >= 0)
  //     && (k.stop is null or k.stop >= 0))), \
  //   "Negative indexing is not supported."

  //   // # Remember if it's a slice or not. We're going to treat everything as
  //   // # a slice to simply the logic && will `.pop()` at the end as needed.
  //   if (isinstance(k, slice)) {
  //     start = k.start

  //     if (k.stop is not null) {
  //       bound = int(k.stop)
  //     }
  //           else {
  //       bound = null
  //     }
  //   } else {
  //     start = k
  //     bound = k + 1
  //   }
  //   start = start || 0

  //   // # We need check to see if we need to populate more of the cache.
  //   var results
  //   try {
  //     results = this.getResults(start, bound)
  //   } catch (err) {
  //     except StopIteration:
  //     // # There's nothing left, even though the bound is higher.
  //     results = null
  //   }
  //   return results
  // }


  // unable to use this as this is python specific
  async getitem(
    start: number = 0,
    stop?: number,
    step?: number
  ) {

    // """
    // Retrieves an item or slice from the set of results.
    // """
    if (!start && !stop) {
      throw new TypeError()
    }

    if ((start < 0) || (stop < 0)) {
      throw new AssertionError("Negative indexing is not supported.")
    }

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
      /* @ts-ignore  mixin infer wrongly */
      results = await this.getResults(start, bound)
    } catch (err) {
      // except StopIteration:
      // # There's nothing left, even though the bound is higher.
      results = null
    }
    return results
  }

  // async getResults(start, stop): Promise<string[]> {
  //   throw new NotImplementedError('please define this function in subclasses')
  // }
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
    const results = await (promisify(this.redis.lrange).bind(this.redis))(key, start, stop)
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

    async function _append_many(redis, values) {
      for (const value of values) {
        // logger.debug('adding to %s with value %s', key, value)
        const result = await (promisify(redis.rpush).bind(this.redis))(key, value)
        results.push(result)
      }
      return results
    }
    // # start a new map redis or go with the given one
    results = await this._pipeline_if_needed(_append_many, values)

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

    async function _remove_many(redis, values) {
      for await (const value of values) {
        // logger.debug('removing from %s with value %s', key, value)
        const result = await (promisify(redis.lrem).bind(this))(key, 10, value)
        results.push(result)
      }
      return results
    }
    // # start a new map redis or go with the given one
    results = await this._pipeline_if_needed(_remove_many, values)

    return results
  }

  async count() {
    const key = this.getKey()
    // const count = await this.redis.llen(key)

    const count = await (promisify(this.redis.llen).bind(this))(key)


    return count
  }

  async trim() {
    // '''
    // Removes the old items in the list
    // '''
    // # clean up everything with a rank lower than max items up to the end of
    // # the list
    const key = this.getKey()
    // const removed = await this.redis.ltrim(key, 0, this.max_items - 1)

    const removed = await (promisify(this.redis.ltrim).bind(this))(key, 0, this.max_items - 1)
    const msg_format = 'cleaning up the list %s to a max of %s items'
    // logger.info(msg_format, this.getKey(), this.max_items)
    return removed
  }
}

export class FallbackRedisListCache extends RedisListCache {

  // '''
  // Redis list cache which after retrieving all items from redis falls back
  // to a main data source (like the database)
  // '''
  keyFormat = s => `redis:db_list_cache:${s}`

  async get_fallback_results(start, stop) {
    throw new NotImplementedError('please define this function in subclasses')
  }
  async getResults(start, stop) {
    // '''
    // Retrieves results from redis && the fallback datasource
    // '''
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
        // logger.info('setting cache for type %s with len %s',
        // this.getKey(), len(db_results.length))
        // # only cache when we have no results, to prevent duplicates
        await this.cache(db_results)
      } else if (start == 0 && redis_results && !filtered) {
        // logger.info('overwriting cache for type %s with len %s',
        // this.getKey(), len(db_results))
        // # clear the cache && add these values
        await this.overwrite(db_results)
      }
      results = db_results
      // logger.info(
      // 'retrieved %s to %s from db && not from cache with key %s' %
      // (start, stop, this.getKey()))
    } else {
      results = redis_results
      // logger.info('retrieved %s to %s from cache on key %s' %
      // (start, stop, this.getKey()))
    }
    return results
  }

  async get_redis_results(start, stop) {
    // '''
    // Returns the results from redis

    // :param start: the beginning
    // :param stop: the end
    // '''
    const results = await super.getResults(start, stop)
    return results
  }

  async cache(fallback_results) {
    // '''
    // Hook to write the results from the fallback to redis
    // '''
    await this.append_many(fallback_results)
  }

  async overwrite(fallback_results) {
    // '''
    // Clear the cache && write the results from the fallback
    // '''
    await this.delete()
    await this.cache(fallback_results)
  }

}