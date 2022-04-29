import { NotImplementedError, ValueError } from "../../errors"
// import { zip } from "../../utils"
import { BaseTimelineStorage } from "../base/base"
import { getRedisConnection } from "./connection"
import { RedisSortedSetCache } from "./structures/sorted_set"
import zip from 'lodash/zip'
import chunk from 'lodash/chunk'
import createDebug from 'debug'

const debug = createDebug('test:RedisTimelineStorage')

export class TimelineCache extends RedisSortedSetCache {
  sort_asc = false
}

export class RedisTimelineStorage extends BaseTimelineStorage {

  flush() { throw new NotImplementedError() }

  getCache(key) {
    const redis_server = this.options?.['redis_server'] || 'default'
    const cache = new TimelineCache(key, null, redis_server)
    return cache
  }

  contains(key, activityId) {
    const cache = this.getCache(key)
    const contains = cache.contains(activityId)
    return contains
  }

  /**
   * Returns a slice from the storage
   * **Example**::
   *    getSliceFromStorage('feed:13', 0, 10, {activity_id__lte=10})
   * @param key: the redis key at which the sorted set is located
   * @param start: the start
   * @param stop: the stop
   * @param filterKwargs: a dict of filter kwargs
   * @param orderingArgs: a list of fields used for sorting
   */
  async getSliceFromStorage({
    key,
    start,
    stop,
    filterKwargs,
    orderingArgs
  }) {
    debug('getSliceFromStorage', key, start, stop, filterKwargs, orderingArgs)

    const cache = this.getCache(key)
    // # parse the filter kwargs && translate them to min max
    // # as used by the get results function
    const valid_kwargs = [
      'activity_id__gte', 'activity_id__lte',
      'activity_id__gt', 'activity_id__lt',
    ]
    filterKwargs = filterKwargs || {}
    const result_kwargs = {}

    for (const k of valid_kwargs) {
      var v = filterKwargs[k] || null
      if (v) {
        // pop k key from filter
        delete filterKwargs[k]
        if (!(typeof v !== 'number')) {
          throw new ValueError(`Filter kwarg values should be floats, int or long, got ${k}=${v}`)
        }
        // # By default, the interval specified by min_score && max_score is closed (inclusive).
        // # It is possible to specify an open interval (exclusive) by prefixing the score with the character (
        const [_, direction] = k.split('__')
        const equal = 'te' in (direction as any)

        if ('gt' in (direction as any)) {
          if (!equal) {
            v = '(' + (v)
          }
          result_kwargs['min_score'] = v
        } else {
          if (!equal) {
            v = '(' + (v)
          }
          result_kwargs['max_score'] = v
        }
      }
    }

    // # complain if we didn't recognize the filter kwargs
    if (Object.keys(filterKwargs).length)
      throw new ValueError(`Unrecognized filter kwargs ${filterKwargs}`)

    if (orderingArgs && orderingArgs.length) {
      if (orderingArgs.length > 1)
        throw new ValueError(`Too many order kwargs ${orderingArgs}`)

      if ('-activityId' in orderingArgs)
        // # descending sort
        cache.sort_asc = false
      else if ('activityId' in orderingArgs)
        cache.sort_asc = true
      else
        throw new ValueError(`Unrecognized order kwargs ${orderingArgs}`)
    }


    // # get the actual results
    // python is returning (value, key)
    // but in node it is in string form value, key, value, key 
    const value_key_strings = await cache.getResults({
      start,
      stop,
      ...result_kwargs
    })
    const valueKeyPairs = chunk(value_key_strings, 2)
    const score_key_pairs = valueKeyPairs.map((vk) => {
      const [value, key] = vk
      return [key, value]
    })

    debug('score_key_pairs', score_key_pairs);
    return score_key_pairs
  }

  getBatchInterface() {
    const serverName = this.options['redis_server'] || 'default'
    return getRedisConnection(serverName)// .pipeline(transaction = false)
  }

  getIndexOf(key, activityId) {
    const cache = this.getCache(key)
    const index = cache.indexOf(activityId)
    return index
  }

  // key,
  // serializedActivities,
  // kwargs
  async addToStorage(
    key,
    activities, // in the form of 123:123
    kwargs = {} as any
  ) {

    const { batchInterface } = kwargs
    const cache = this.getCache(key)
    // # turn it into key value pairs
    const scores = Object.keys(activities)  // map(long_t, activities.keys())
    const scoreValuePairs = zip(scores, Object.values(activities))
 
    const result = await cache.addMany(scoreValuePairs)

    for (const r of result) {
      // # errors in strings?
      // # anyhow throw new them here :)
      if (r?.isdigit && !r.isdigit()) {
        throw new ValueError(`got error ${r} in results ${result}`)
      }
      return result
    }
  }

  removeFromStorage(key, activities, batchInterface = null) {
    const cache = this.getCache(key)
    // const results = cache.removeMany(activities.values())
    const results = cache.removeMany(Object.values(activities))
    return results
  }

  count(key) {
    const cache = this.getCache(key)
    return Number(cache.count())
  }

  delete(key) {
    const cache = this.getCache(key)
    cache.delete()
  }

  trim(key, length, batchInterface = null) {
    const cache = this.getCache(key)
    cache.trim(length)
  }
}