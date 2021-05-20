import { ValueError } from "../../errors"
import { BaseTimelineStorage } from "../base"
import { RedisSortedSetCache } from "./structures/sorted_set"

export class TimelineCache extends RedisSortedSetCache {
  sort_asc = false
}

export class RedisTimelineStorage extends BaseTimelineStorage {

  get_cache(key) {
    const redis_server = this.options.get('redis_server', 'default')
    const cache = new TimelineCache(key, redis_server = redis_server)
    return cache
  }

  contains(key, activity_id) {
    const cache = this.get_cache(key)
    const contains = cache.contains(activity_id)
    return contains
  }

  get_slice_from_storage(key, start, stop, filter_kwargs = null, ordering_args = null) {
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
      const v = filter_kwargs.pop(k, null)
      if (v is not null) {
        if (not isinstance(v, (float, six.integer_types))) {
          throw new ValueError(
            'Filter kwarg values should be floats, int or long, got %s=%s' % (k, v))
        }
        // # By default, the interval specified by min_score && max_score is closed (inclusive).
        // # It is possible to specify an open interval (exclusive) by prefixing the score with the character (
        _, direction = k.split('__')
        const   equal = 'te' in direction

        if ('gt' in direction) {
          if (not equal) {
            v = '(' + str(v)
          }
          result_kwargs['min_score'] = v
        } else {
          if (not equal) {
            v = '(' + str(v)
          }
          result_kwargs['max_score'] = v
        }
      }
    }
    // # complain if we didn't recognize the filter kwargs
    if (filter_kwargs)
      throw new ValueError('Unrecognized filter kwargs %s' % filter_kwargs)

    if (ordering_args) {
      if (len(ordering_args) > 1)
        throw new ValueError('Too many order kwargs %s' % ordering_args)

      if ('-activity_id' in ordering_args)
        // # descending sort
        cache.sort_asc = false
      else if ('activity_id' in ordering_args)
        cache.sort_asc = true
      else
        throw new ValueError('Unrecognized order kwargs %s' % ordering_args)
    }
    // # get the actual results
    const key_score_pairs = cache.get_results(start, stop, ** result_kwargs)
    const score_key_pairs = [(score, data) for data, score in key_score_pairs]

    return score_key_pairs
  }
  get_batch_interface() {
    return get_redis_connection(
      server_name = this.options.get('redis_server', 'default')
    ).pipeline(transaction = false)
  }

  get_index_of(key, activity_id) {
    const cache = this.get_cache(key)
    const index = cache.index_of(activity_id)
    return index
  }

  add_to_storage(key, activities, batch_interface = null, kwargs) {
    const cache = this.get_cache(key)
    // # turn it into key value pairs
    const scores = map(long_t, activities.keys())
    const score_value_pairs = list(zip(scores, activities.values()))
    const result = cache.add_many(score_value_pairs)
    for (const r of result) {
      // # errors in strings?
      // # anyhow throw new them here :)
      if( hasattr(r, 'isdigit') && not r.isdigit()){
        throw new ValueError('got error %s in results %s' % (r, result))
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
    return int(cache.count())
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