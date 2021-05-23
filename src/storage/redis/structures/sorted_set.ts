import { ValueError } from "../../../errors"
import { zip } from "../../../utils"
import { BaseRedisListCache } from "./list"
import { promisify } from 'util'
import { BaseRedisHashCache } from "./hash"
import chunk from 'lodash/chunk'
import { RedisCache } from "./base"
import { RedisClient } from "redis"

// export class RedisSortedSetCache extends BaseRedisListCache, BaseRedisHashCache {
export class RedisSortedSetCache extends RedisCache {

  sort_asc = false

  async count() {
    // '''
    // Returns the number of elements in the sorted set
    // '''
    const key = this.get_key()
    const redis_result = await promisify(this.redis.zcard)(key)
    // #lazily convert this to an int, this keeps it compatible with
    // #distributed connections
    // const redis_count = lambda: int(redis_result)
    // const lazy_factory = lazy(redis_count, * six.integer_types)
    // const lazy_object = lazy_factory()
    // return lazy_object
    return Number(redis_result)
  }
  index_of(value) {
    // '''
    // Returns the index of the given value
    // '''
    var redis_rank_fn
    if (this.sort_asc) {
      redis_rank_fn = this.redis.zrank
    } else {
      redis_rank_fn = this.redis.zrevrank
    }
    const key = this.get_key()
    var result = redis_rank_fn(key, value)
    if (result) {
      result = Number(result)
    }
    else if (!result) {
      throw new ValueError(
        `Couldnt find item with value ${value} in key ${key}`)
    }
    return result
  }
  add(score, key) {
    const score_value_pairs = [[score, key]]
    const results = this.add_many(score_value_pairs)
    const result = results[0]
    return result
  }
  async add_many(score_value_pairs) {
    // '''
    // StrictRedis so it expects score1, name1
    // ''' 
    const key = this.get_key()
    const scores = (zip(...score_value_pairs))[0] as string[]
    // console.log(zip(...score_value_pairs));
    scores.forEach(element => {
      if (isNaN(Number(element)))
        throw new Error(`Please send floats as the first part of the pairs got ${score_value_pairs}`)

      // if (typeof element === "number")
      return true
    });

    // const numeric_types = (float,) + six.integer_types
    // if (not all([isinstance(score, numeric_types) for score in scores])) {
    //   const msg_format = `Please send floats as the first part of the pairs got ${score_value_pairs}`
    //   throw new ValueError(msg_format)
    // }
    var results = []

    async function _add_many(
      redis: RedisClient,
      score_value_pairs
    ) {
      const score_value_list = score_value_pairs.reduce((acc, curr) => acc + curr) // sum(map(list, score_value_pairs), [])
      const score_value_chunks = chunk(score_value_list, 200)
      console.log(';;;;;;;');
      console.log(score_value_list);
      // const args = ["myzset", 1, "one", 2, "two", 3, "three", 99, "ninety-nine"]
      // redis.zadd(...args, (err, response) => {
      //   console.log(err);
      //   console.log('response: ', response);

      //   redis.zrange('myzset', 0, 4, (err, response) => {
      //     console.log(err);
      //     console.log('response for myzset: ', response);
      //   })
      // })

      for await (const score_value_chunk of score_value_chunks) {
        // redis.zadd(key, ...score_value_chunk as any, (err, response) => {
        //   console.log(err);
        //   console.log(response);
        //   console.log(key);
        //   redis.zrange(key, 0, 10, (err, response) => {
        //     console.log(err);
        //     console.log(response);
        //   })
        // })

        // const response = await (promisify(redis.zadd).bind(redis))(key, ...score_value_chunk as any).catch(err => {
        //   console.log(err);
        // }) 
        const result = await (promisify(redis.zadd).bind(redis))(key, ...score_value_chunk)

        // const res = await (promisify(redis.zrange).bind(redis))(key, 0, 100)
        // const res2 = await (promisify(redis.zrem).bind(redis))(key)
        // console.log(res.map(a => a));
        // const result = {}
        // logger.debug('adding to ${} with score_value_chunk ${}',
        //   key, score_value_chunk)
        results.push(result)
      }
      return results
    }
    // #start a new map redis or go with the given one
    results = await this._pipeline_if_needed(_add_many, score_value_pairs)

    return results
  }
  async remove_many(values) {
    // '''
    // values
    // '''
    const key = this.get_key()
    var results = []

    async function _remove_many(redis, values) {
      for (const value of values) {
        // logger.debug('removing value ${} from ${}', value, key)
        const result = await promisify(redis.zrem)(key, value)
        results.push(result)
      }
      return results
    }
    // #start a new map redis or go with the given one
    results = await this._pipeline_if_needed(_remove_many, values)

    return results
  }
  async remove_by_scores(scores) {
    const key = this.get_key()
    var results = []

    function _remove_many(redis, scores) {
      for (const score of scores) {
        // logger.debug('removing score ${} from ${}', score, key)
        const result = redis.zremrangebyscore(key, score, score)
        results.push(result)
      }
      return results
    }
    // #start a new map redis or go with the given one
    results = await this._pipeline_if_needed(_remove_many, scores)

    return results
  }
  contains(value) {
    // '''
    // Uses zscore to see if the given activity is present in our sorted set
    // '''
    const key = this.get_key()
    const result = this.redis.zscore(key, value)
    const activity_found = !!(result)
    return activity_found
  }

  trim(max_length = null) {
    // '''
    // Trim the sorted set to max length
    // zremrangebyscore
    // '''
    const key = this.get_key()
    if (!max_length) {
      max_length = this.max_length
    }
    // #map things to the funny redis syntax
    var begin, end
    if (this.sort_asc) {
      begin = max_length
      end = -1
    } else {
      begin = 0
      end = (max_length * -1) - 1
    }
    const removed = this.redis.zremrangebyrank(key, begin, end)
    // logger.info('cleaning up the sorted set ${} to a max of ${} items' %
    //   (key, max_length))
    return removed
  }

  async get_results({
    start = null,
    stop = null,
    min_score = null,
    max_score = null
  }) {
    // '''
    // Retrieve results from redis using zrevrange
    // O(log(N)+M) with N being the number of elements in the sorted set && M the number of elements returned.
    // '''
    var redis_range_fn

    // console.log(this.sort_asc);
    if (this.sort_asc)
      redis_range_fn = promisify(this.redis.zrangebyscore).bind(this.redis)
    else
      redis_range_fn = promisify(this.redis.zrevrangebyscore).bind(this.redis)

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
    const key = this.get_key()

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

    // console.log(
    //   key,
    //   min_score,
    //   max_score,
    //   true,
    //   limit,
    //   start,
    // );
    // const results = await redis_range_fn(
    //   key,
    //   min_score,
    //   max_score,
    //   true,
    //   limit,
    //   start,
    // )

    const results = await redis_range_fn(
      key,
      min_score,
      max_score,
      "WITHSCORES",
      "LIMIT",
      start,
      limit,
    )
    console.log(results);
    // // console.log(this.redis);
    // const r1 = await (
    //   promisify(this.redis.zrange).bind(this.redis)
    // )(
    //   key,
    //   0, 10
    // )
    // console.log("r1", r1);
    // const results = await (
    //   promisify(this.redis.zrevrangebyscore).bind(this.redis)
    // )(
    //   key,
    //   min_score,
    //   max_score,
    //   "WITHSCORES",
    //   "LIMIT",
    //   start,
    //   limit,
    // )
    // console.log(results);
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