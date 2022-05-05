import createDebug from 'debug'
import chunk from 'lodash/chunk'
import { Mixin } from 'ts-mixer'
import { promisify } from 'util'
import { ValueError } from "../../../errors"
import { zip } from "../../../utils"
import { TScoreValuePair } from '../redis.type'
import { BaseRedisHashCache } from "./hash"
import { BaseRedisListCache } from "./list"

const debug = createDebug('ns:debug:sorted_set')

/**
 * We use this mostly to store activityId with score
 * We will use others to store activity payload
 */
export class RedisSortedSetCache extends Mixin(BaseRedisListCache, BaseRedisHashCache) {

  sort_asc = false

  // Returns the number of elements in the sorted set
  async count() {
    const key = this.getKey()
    const redisResult = await this.redis.zCard(key)
    // #lazily convert this to an int, this keeps it compatible with
    // #distributed connections
    // const redis_count = lambda: int(redis_result)
    // const lazy_factory = lazy(redis_count, * six.integer_types)
    // const lazy_object = lazy_factory()
    // return lazy_object
    return Number(redisResult)
  }


  // Returns the index of the given value
  async indexOf(value) {
    var redisRankFn = this.sort_asc
      ? this.redis.zRank
      : this.redis.zRevRank

    const key = this.getKey()

    var result = await (promisify(redisRankFn).bind(this.redis))(key, value)
    if (result) {
      result = Number(result)
    }
    else if (!result) {
      throw new ValueError(
        `Couldnt find item with value ${value} in key ${key}`)
    }
    return result
  }

  async add(score: string, key: string) {
    const scoreValuePairs: TScoreValuePair[] = [[score, key]]
    const results = await this.addMany(scoreValuePairs)
    const result = results[0]
    return result
  }

  async addMany(scoreValuePairs: TScoreValuePair[]) {
    // validate
    const key = this.getKey()
    console.log('scoreValuePairs',scoreValuePairs);
    const scores = (zip(...scoreValuePairs))[0]
    scores.forEach(element => {
      console.log('element', element);

      if (isNaN(Number(element)))
        throw new Error(`Please send floats as the first part of the pairs got ${scoreValuePairs}`)
      return true
    });

    const results: number[] = []
    const members = scoreValuePairs.map((svp) => ({
      score: Number(svp[0]),
      value: svp[1],
    }))
    let membersChunk = chunk(members, 200)
    for await (const members of membersChunk) {
      const result = await this.redis.zAdd(key, members)
      debug(`adding to ${key} with members ${members}`)
      results.push(result)
    }
    return results
  }

  async removeMany(values) {
    const key = this.getKey()
    var results = []
    for (const value of values) {
      debug(`removing value ${value} from ${key}`)
      const result = await this.redis.zRem(key, value)
      results.push(result)
    }
    return results
  }

  async remove_by_scores(scores) {
    const key = this.getKey()
    var results = []
    for await (const score of scores) {
      debug(`removing score ${score} from ${key}`)
      const result = await this.redis.zRemRangeByScore(key, score, score)
      results.push(result)
    }
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
    if (!stop)
      stop = -1

    if (!start)
      start = 0

    var limit
    if (stop != -1) {
      limit = stop - start
    } else {
      limit = -1
    }
    const key = this.getKey()

    // #some type validations
    if (min_score && (typeof min_score !== 'number' || typeof min_score !== 'string'))
      throw new ValueError(`min_score is not of type float, int, long or str got ${min_score}`)

    if (max_score && (typeof max_score !== 'number' || typeof max_score !== 'string'))
      throw new ValueError(`max_score is not of type float, int, long or str got ${max_score}`)


    if (!min_score)
      min_score = this.sort_asc ? '-inf' : '+inf'

    if (!max_score)
      max_score = this.sort_asc ? '+inf' : '-inf'

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
    results.forEach(element => {
      a.push(element.value)
      a.push(element.score)
    })
    return a
  }
}

