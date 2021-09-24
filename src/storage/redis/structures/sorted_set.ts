import { ValueError } from "../../../errors"
import { zip } from "../../../utils"
import { BaseRedisListCache } from "./list"
import { promisify } from 'util'
import { BaseRedisHashCache } from "./hash"
import chunk from 'lodash/chunk'
import { RedisCache } from "./base"
import { RedisClientType } from "redis/dist/lib/client"


// export class RedisSortedSetCache extends BaseRedisListCache, BaseRedisHashCache {
export class RedisSortedSetCache extends RedisCache {

  sort_asc = false

  // Returns the number of elements in the sorted set
  async count() {
    const key = this.getKey()
    // const redis_result = await (promisify(this.redis.zcard).bind(this.redis))(key)
    const redis_result = await this.redis.zCard(key)
    // #lazily convert this to an int, this keeps it compatible with
    // #distributed connections
    // const redis_count = lambda: int(redis_result)
    // const lazy_factory = lazy(redis_count, * six.integer_types)
    // const lazy_object = lazy_factory()
    // return lazy_object
    return Number(redis_result)
  }


  // Returns the index of the given value
  async indexOf(value) {
    // var redis_rank_fn = this.sort_asc
    //   ? this.redis.zrank
    //   : this.redis.zrevrank
    var redis_rank_fn = this.sort_asc
      ? this.redis.zRank
      : this.redis.zRevRank

    const key = this.getKey()

    var result = await (promisify(redis_rank_fn).bind(this.redis))(key, value)
    if (result) {
      result = Number(result)
    }
    else if (!result) {
      throw new ValueError(
        `Couldnt find item with value ${value} in key ${key}`)
    }
    return result
  }

  async add(score, key) {
    const scoreValuePairs = [[score, key]]

    const results = await this.addMany(scoreValuePairs)
    const result = results[0]
    return result
  }

  // StrictRedis so it expects score1, name1
  async addMany(scoreValuePairs) {
    const key = this.getKey()
    const scores = (zip(...scoreValuePairs))[0] as string[]
    scores.forEach(element => {
      if (isNaN(Number(element)))
        throw new Error(`Please send floats as the first part of the pairs got ${scoreValuePairs}`)

      // if (typeof element === "number")
      return true
    });

    // const numeric_types = (float,) + six.integer_types
    // if (not all([isinstance(score, numeric_types) for score in scores])) {
    //   const msg_format = `Please send floats as the first part of the pairs got ${scoreValuePairs}`
    //   throw new ValueError(msg_format)
    // }
    var results = []

    async function _addMany(
      redis: RedisClientType,
      scoreValuePairs
    ) {
      /**
       * main purpose for this is:
       * convert from 
       * [['bac', 3], ['abc', 4]]
       * to this in chunk
       * [bac, 3, abc, 4]
       */
      // sum(map(list, scoreValuePairs), [])
      console.log('scoreValuePairs', scoreValuePairs);

      // const score_value_list = scoreValuePairs.reduce((acc, curr) => acc + curr)
      const score_value_list = scoreValuePairs.reduce((acc, curr) => {
        curr.forEach(element => {
          acc.push(element)
        });
        // acc.push(curr[0])
        // acc.push(curr[1])
        return acc
      }, [])
      const score_value_chunks = chunk(score_value_list, 200)

      console.log('score_value_chunks', score_value_chunks);
      console.log('key', key);
      for await (const score_value_chunk of score_value_chunks) {
        // const result = await (promisify(redis.zadd).bind(redis))(key, ...score_value_chunk)

        console.log(score_value_chunk);

        // @ts-ignore
        const result = await redis.zAdd(key, ...score_value_chunk)
 
        // const result = await redis.zAdd(key, ...score_value_chunk)


        // const result = await (promisify(redis.zadd).bind(redis))(key, activityId, JSON.stringify(activity))

        // logger.debug('adding to ${} with score_value_chunk ${}', key, score_value_chunk)
        results.push(result)
      }
      return results
    }

    // #start a new map redis or go with the given one
    results = await this._pipeline_if_needed(_addMany, scoreValuePairs)

    return results
  }

  // values
  async removeMany(values) {

    const key = this.getKey()
    var results = []

    async function _remove_many(redis: RedisClientType, values) {
      for (const value of values) {
        // logger.debug('removing value ${} from ${}', value, key)
        // const result = await (promisify(redis.zrem).bind(redis))(key, value)
        const result = await redis.zRem(key, value)
        results.push(result)
      }
      return results
    }
    // #start a new map redis or go with the given one
    results = await this._pipeline_if_needed(_remove_many, values)

    return results
  }

  async remove_by_scores(scores) {
    const key = this.getKey()
    var results = []

    async function _remove_many(redis: RedisClientType, scores) {
      for await (const score of scores) {
        // logger.debug('removing score ${} from ${}', score, key)
        // const result = redis.zremrangebyscore(key, score, score)
        const result = await redis.zRemRangeByScore(key, score, score)
        results.push(result)
      }
      return results
    }
    // #start a new map redis or go with the given one
    results = await this._pipeline_if_needed(_remove_many, scores)

    return results
  }

  // Uses zscore to see if the given activity is present in our sorted set
  contains(value) {
    const key = this.getKey()
    // const result = this.redis.zscore(key, value)
    const result = this.redis.zScore(key, value)
    const activity_found = !!(result)
    return activity_found
  }

  // Trim the sorted set to max length
  // zremrangebyscore
  async trim(maxLength = null) {

    const key = this.getKey()
    if (!maxLength) {
      maxLength = this.maxLength
    }
    // #map things to the funny redis syntax
    var begin, end
    if (this.sort_asc) {
      begin = maxLength
      end = -1
    } else {
      begin = 0
      end = (maxLength * -1) - 1
    }
    const removed = await this.redis.zRemRangeByRank(key, begin, end)
    // const removed = await this.redis.zremrangebyrank(key, begin, end)
    // logger.info('cleaning up the sorted set ${} to a max of ${} items' %
    //   (key, maxLength))
    return removed
  }

  // Retrieve results from redis using zrevrange
  // O(log(N)+M) with N being the number of elements in the sorted set && M the number of elements returned.
  async getResults({
    start = null,
    stop = null,
    min_score = null,
    max_score = null
  }) {

    var redis_range_fn

    // if (this.sort_asc)
    //   redis_range_fn = promisify(this.redis.zrangebyscore).bind(this.redis)
    // else
    //   redis_range_fn = promisify(this.redis.zrevrangebyscore).bind(this.redis)
    if (this.sort_asc)
      redis_range_fn = this.redis.zRemRangeByScore
    else
      redis_range_fn = this.redis.zRemRangeByScore

    // #-1 means infinity
    if (!stop) {
      stop = -1
    }
    if (!start) {
      start = 0
    }

    var limit
    if (stop != -1) {
      limit = stop - start
    } else {
      limit = -1
    }
    const key = this.getKey()

    // #some type validations
    if (min_score && (typeof min_score !== 'number' || typeof min_score !== 'string')) {
      throw new ValueError(`min_score is not of type float, int, long or str got ${min_score}`)
    }

    if (max_score && (typeof max_score !== 'number' || typeof max_score !== 'string')) {
      throw new ValueError(
        `max_score is not of type float, int, long or str got ${max_score}`)
    }

    if (!min_score) {
      min_score = this.sort_asc ? '-inf' : '+inf'
    }

    if (!max_score) {
      max_score = this.sort_asc ? '+inf' : '-inf'
    }

    // #handle the starting score support
    const results = await redis_range_fn(
      key,
      min_score,
      max_score,
      "WITHSCORES",
      "LIMIT",
      start,
      limit,
    )
    return results
  }
}

export interface RedisSortedSetCache extends BaseRedisListCache, BaseRedisHashCache { }

// Apply the mixins into the base class via
// the JS at runtime
applyMixins(RedisSortedSetCache, [BaseRedisListCache, BaseRedisHashCache]);

// This can live anywhere in your codebase:
function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
        Object.create(null)
      );
    });
  });
}