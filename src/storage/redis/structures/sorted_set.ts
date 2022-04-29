import chunk from 'lodash/chunk'
import { promisify } from 'util'
import { ValueError } from "../../../errors"
import { zip } from "../../../utils"
import { RedisCache } from "./base"
import { BaseRedisHashCache } from "./hash"
import { BaseRedisListCache } from "./list"
import createDebug from 'debug'
import { Mixin } from 'ts-mixer';
import { RedisClientType } from 'redis'

const debug = createDebug('ns:debug:sorted_set')


export class RedisSortedSetCache extends Mixin(BaseRedisListCache, BaseRedisHashCache) {
  // export class RedisSortedSetCache extends RedisCache {

  sort_asc = false

  // Returns the number of elements in the sorted set
  async count() {
    const key = this.getKey()
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
      // // Please send floats as the first part of the pairs got 70262030-c7a9-11ec-941b-6d18f0aebf4f,70262030-c7a9-11ec-941b-6d18f0aebf4f
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
      const members = scoreValuePairs.map((svp) => ({
        score: Number(svp[0]),
        value: svp[1],
      }))
      let membersChunk
      try {

        membersChunk = chunk(members, 200) as { value: string, score: number }[][]
      } catch (error) {
        console.log('found error');
        throw error
      }

      for await (const members of membersChunk) {
        const result = await redis.zAdd(key, members)
        debug(`adding to ${key} with members ${members}`)
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
        debug(`removing value ${value} from ${key}`)
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
        debug(`removing score ${score} from ${key}`)
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
  async contains(value) {
    const key = this.getKey()
    const result = await this.redis.zScore(key, value)
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

    const results = await this.redis.zRangeWithScores(
      key,
      min_score,
      max_score,
      {
        BY: 'SCORE',
        ...(this.sort_asc ? {} : { REV: true }),
        REV: true,
        LIMIT: {
          offset: start,
          count: limit
        }
      }
    )

    const a = []
    results.map(element => {
      a.push(element.value)
      a.push(element.score)
    })
    return a
  }
}


// export interface RedisSortedSetCache extends BaseRedisListCache, BaseRedisHashCache { }

// // Apply the mixins into the base class via
// // the JS at runtime
// applyMixins(RedisSortedSetCache, [BaseRedisListCache, BaseRedisHashCache]);

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