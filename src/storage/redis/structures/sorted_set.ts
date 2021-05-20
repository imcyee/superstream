import { ValueError } from "../../../errors"
import { BaseRedisListCache } from "./list"



export class RedisSortedSetCache extends BaseRedisListCache, BaseRedisHashCache {
  sort_asc = false

  count() {
    // '''
    // Returns the number of elements in the sorted set
    // '''
    const key = this.get_key()
    const redis_result = this.redis.zcard(key)
    // #lazily convert this to an int, this keeps it compatible with
    // #distributed connections
    const redis_count = lambda: int(redis_result)
    const lazy_factory = lazy(redis_count, * six.integer_types)
    const lazy_object = lazy_factory()
    return lazy_object
  }
  index_of(value) {
    // '''
    // Returns the index of the given value
    // '''
    if (this.sort_asc) {
      redis_rank_fn = this.redis.zrank
    } else {
      redis_rank_fn = this.redis.zrevrank
    }
    const key = this.get_key()
    const result = redis_rank_fn(key, value)
    if (result) {
      result = int(result)
    }
    else if (result is null) {
      throw new ValueError(
        'Couldnt find item with value %s in key %s' % (value, key))
    }
    return result
  }
  add(score, key) {
    const score_value_pairs = [(score, key)]
    const results = this.add_many(score_value_pairs)
    const result = results[0]
    return result
  }
  add_many(score_value_pairs) {
    // '''
    // StrictRedis so it expects score1, name1
    // '''
    const key = this.get_key()
    const scores = list(zip(* score_value_pairs))[0]
    const msg_format = 'Please send floats as the first part of the pairs got %s'
    const numeric_types = (float,) + six.integer_types
    if (not all([isinstance(score, numeric_types) for score in scores])) {
      throw new ValueError(msg_format % score_value_pairs)
    }
    var results = []

    function _add_many(redis, score_value_pairs) {
      const score_value_list = sum(map(list, score_value_pairs), [])
      const score_value_chunks = chunks(score_value_list, 200)

      for (score_value_chunk in score_value_chunks) {
        const result = redis.zadd(key, * score_value_chunk)
        logger.debug('adding to %s with score_value_chunk %s',
          key, score_value_chunk)
        results.append(result)
      }
      return results
    }
    // #start a new map redis or go with the given one
    results = this._pipeline_if_needed(_add_many, score_value_pairs)

    return results
  }
  remove_many(values) {
    // '''
    // values
    // '''
    const key = this.get_key()
    var results = []

    function _remove_many(redis, values) {
      for (value in values) {
        logger.debug('removing value %s from %s', value, key)
        result = redis.zrem(key, value)
        results.append(result)
      }
      return results
    }
    // #start a new map redis or go with the given one
    results = this._pipeline_if_needed(_remove_many, values)

    return results
  }
  remove_by_scores(scores) {
    const key = this.get_key()
    var results = []

    function _remove_many(redis, scores) {
      for (score in scores) {
        logger.debug('removing score %s from %s', score, key)
        result = redis.zremrangebyscore(key, score, score)
        results.append(result)
      }
      return results
    }
    // #start a new map redis or go with the given one
    results = this._pipeline_if_needed(_remove_many, scores)

    return results
  }
  contains(value) {
    // '''
    // Uses zscore to see if the given activity is present in our sorted set
    // '''
    const key = this.get_key()
    const result = this.redis.zscore(key, value)
    const activity_found = result is not null
    return activity_found
  }

  trim(max_length = null) {
    // '''
    // Trim the sorted set to max length
    // zremrangebyscore
    // '''
    const key = this.get_key()
    if (max_length is null) {
      max_length = this.max_length
    }
    // #map things to the funny redis syntax
    if (this.sort_asc) {
      begin = max_length
      end = -1
    } else {
      begin = 0
      end = (max_length * -1) - 1
    }
    const removed = this.redis.zremrangebyrank(key, begin, end)
    logger.info('cleaning up the sorted set %s to a max of %s items' %
      (key, max_length))
    return removed
  }

  get_results(start = null, stop = null, min_score = null, max_score = null) {
    // '''
    // Retrieve results from redis using zrevrange
    // O(log(N)+M) with N being the number of elements in the sorted set && M the number of elements returned.
    // '''
    if (this.sort_asc) {
      redis_range_fn = this.redis.zrangebyscore
    }
    else {
      redis_range_fn = this.redis.zrevrangebyscore
    }
    // #-1 means infinity
    if (stop is null) {
      stop = -1
    }
    if (start is null) {
      start = 0
    }
    if (stop != -1) {
      limit = stop - start
    } else {
      limit = -1
    }
    const key = this.get_key()

    // #some type validations
    if (min_score && not isinstance(min_score, (float, str, six.integer_types))) {
      throw new ValueError(`min_score is not of type float, int, long or str got ${min_score}`)
    }

    if (max_score && not isinstance(max_score, (float, str, six.integer_types))) {
      throw new ValueError(
        'max_score is not of type float, int, long or str got %s' % max_score)
    }

    if (min_score is null) {
      min_score = '-inf'
    }

    if (max_score is null) {
      max_score = '+inf'
    }

    // #handle the starting score support
    const results = redis_range_fn(
      key, start = start, num = limit, withscores = true, min = min_score, max = max_score)
    return results
  }
}