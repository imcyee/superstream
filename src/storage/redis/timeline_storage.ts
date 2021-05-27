import { ValueError } from "../../errors"
// import { zip } from "../../utils"
import { BaseTimelineStorage } from "../base"
import { get_redis_connection } from "./connection"
import { RedisSortedSetCache } from "./structures/sorted_set"
import zip from 'lodash/zip'
import chunk from 'lodash/chunk'

export class TimelineCache extends RedisSortedSetCache {
  sort_asc = false
}

export class RedisTimelineStorage extends BaseTimelineStorage {

  get_cache(key) {
    const redis_server = this.options?.['redis_server'] || 'default'
    const cache = new TimelineCache(key, null, redis_server)
    return cache
  }

  contains(key, activity_id) {
    const cache = this.get_cache(key)
    const contains = cache.contains(activity_id)
    return contains
  }

  async get_slice_from_storage({
    key,
    start,
    stop,
    filter_kwargs,
    ordering_args
  }) {
    // '''
    // Returns a slice from the storage
    // :param key: the redis key at which the sorted set is located
    // :param start: the start
    // :param stop: the stop
    // :param filter_kwargs: a dict of filter kwargs
    // :param ordering_args: a list of fields used for sorting

    // **Example**::
    //    get_slice_from_storage('feed:13', 0, 10, {activity_id__lte=10})
    // ''' 
    const cache = this.get_cache(key)
    // # parse the filter kwargs && translate them to min max
    // # as used by the get results function
    const valid_kwargs = [
      'activity_id__gte', 'activity_id__lte',
      'activity_id__gt', 'activity_id__lt',
    ]
    filter_kwargs = filter_kwargs || {}
    const result_kwargs = {}

    for (const k of valid_kwargs) {
      var v = filter_kwargs[k] || null
      if (v) {
        // pop k key from filter
        delete filter_kwargs[k]
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
    if (Object.keys(filter_kwargs).length)
      throw new ValueError(`Unrecognized filter kwargs ${filter_kwargs}`)

    if (ordering_args && ordering_args.length) {
      if (ordering_args.length > 1)
        throw new ValueError(`Too many order kwargs ${ordering_args}`)

      if ('-activity_id' in ordering_args)
        // # descending sort
        cache.sort_asc = false
      else if ('activity_id' in ordering_args)
        cache.sort_asc = true
      else
        throw new ValueError(`Unrecognized order kwargs ${ordering_args}`)
    }

    // # get the actual results
    // python is returning (value, key)
    // but in node it is in string form value, key, value, key 
    const value_key_strings = await cache.get_results({
      start,
      stop,
      ...result_kwargs
    })

    const value_key_pairs = chunk(value_key_strings, 2)
    const score_key_pairs = value_key_pairs.map((vk) => {
      const [value, key] = vk
      return [key, value]
    })
    return score_key_pairs
  }

  get_batch_interface() {
    return get_redis_connection(
      this.options.get('redis_server', 'default')
    )// .pipeline(transaction = false)
  }

  get_index_of(key, activity_id) {
    const cache = this.get_cache(key)
    const index = cache.index_of(activity_id)
    return index
  }
  // key,
  // serialized_activities,
  // kwargs
  async add_to_storage(
    key,
    activities, // in the form of 123:123
    kwargs
  ) {
    const { batch_interface } = kwargs
    const cache = this.get_cache(key)
    // # turn it into key value pairs
    const scores = Object.keys(activities)  // map(long_t, activities.keys())
    const score_value_pairs = zip(scores, Object.values(activities))
    console.log(score_value_pairs);
    const result = await cache.add_many(score_value_pairs)
    for (const r of result) {
      // # errors in strings?
      // # anyhow throw new them here :)
      if (r?.isdigit && !r.isdigit()) {
        throw new ValueError(`got error ${r} in results ${result}`)
      }
      return result
    }
  }

  remove_from_storage(key, activities, batch_interface = null) {
    const cache = this.get_cache(key)
    const results = cache.remove_many(activities.values())
    return results
  }

  count(key) {
    const cache = this.get_cache(key)
    return Number(cache.count())
  }

  delete(key) {
    const cache = this.get_cache(key)
    cache.delete()
  }

  trim(key, length, batch_interface = null) {
    const cache = this.get_cache(key)
    cache.trim(length)
  }
}