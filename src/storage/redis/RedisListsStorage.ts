import { BaseListsStorage } from "../base/base_lists_storage"
import { getRedisConnection } from "./connection"
import { promisify } from 'util' 
import { RedisClientType } from "redis"

export class RedisListsStorage extends BaseListsStorage {
  private _redis

  private _toResult(results) {
    if (results) {
      if ((results.length) == 1) {
        return results[0]
      } else {
        return [...results]
        // return tuple(results)
      }
    }
  }
 
  // delAsync
  // getAsync
  getRedis() {
    // Only load the redis connection if we use it
    if (!this._redis) {
      // @ts-ignore
      this._redis = getRedisConnection(this.redis_server)
      // this.getAsync = promisify(this._redis.get).bind(this._redis);
      // this.delAsync = promisify(this._redis.del).bind(this._redis);
    }
    return this._redis
  }

  // @property
  get redis(): RedisClientType //: RedisClient
  {
    // '''
    // Lazy load the redis connection
    // '''
    try {
      return this.getRedis()
    }
    catch (err) {
      // except AttributeError:
      this._redis = getRedisConnection()
      return this._redis
    }
  }

  getKeys(list_names) {
    const keys = []
    for (const list_name in list_names) {
      keys.push(this.getKey(list_name))
    }
    return keys

    // return [this.getKey(list_name) for list_name in list_names]
  }

  // add(kwargs) {
  //   var pipe
  //   if (kwargs)
  //     pipe = this.redis.pipeline()

  //   for (const k in kwargs) {
  //     const list_name = k
  //     const values = kwargs[k]
  //     // const [list_name, values] = k
  //     if (values) {
  //       const key = this.getKey(list_name)
  //       for (const value of values) {
  //         pipe.rpush(key, value)
  //       }
  //       // # Removes items from list's head
  //       pipe.ltrim(key, -this.maxLength, -1)
  //     }
  //   }

  //   // for (list_name, values in six.iteritems(kwargs)) {
  //   //   if (values) {
  //   //     const key = this.getKey(list_name)
  //   //     for (const value of values) {
  //   //       pipe.rpush(key, value)
  //   //     }
  //   //     // # Removes items from list's head
  //   //     pipe.ltrim(key, -this.maxLength, -1)
  //   //   }
  //   // }
  //   pipe.execute()
  // }
  async add(kwargs) {
    var pipe

    const promises = []
    // if (kwargs)
    //   pipe = this.redis.pipeline()

    for (const k in kwargs) {
      const list_name = k
      const values = kwargs[k]
      // const [list_name, values] = k
      if (values) {
        console.log(this);
        const key = this.getKey(list_name)
        for (const value of values) {
          // pipe.rpush(key, value)

          promises.push(this.redis.rPush(key, value))
        }
        // # Removes items from list's head
        // pipe.ltrim(key, -this.maxLength, -1)
        promises.push(this.redis.lTrim(key, -this.maxLength, -1))
      }
    }

    // for (list_name, values in six.iteritems(kwargs)) {
    //   if (values) {
    //     const key = this.getKey(list_name)
    //     for (const value of values) {
    //       pipe.rpush(key, value)
    //     }
    //     // # Removes items from list's head
    //     pipe.ltrim(key, -this.maxLength, -1)
    //   }
    // }
    await Promise.all(promises)
    // pipe.execute()
  }

  async remove(kwargs) {
    if (kwargs) {
      const promises = []

      for (const k in kwargs) {
        const list_name = k
        const values = kwargs[list_name]

        const key = this.getKey(list_name)
        for (const value in values) {
          // # Removes all occurrences of value in the list
          promises.push(this.redis.lRem(key, 0, value))
        }
      }

      // for (list_name, values in six.iteritems(kwargs)) {
      //   const key = this.getKey(list_name)
      //   for (value in values:) {
      //     // # Removes all occurrences of value in the list
      //     pipe.lrem(key, 0, value)
      //   }
      // }
      await Promise.all(promises)
    }
  }

  async count(...args) {
    const promises = []
    if (args) {
      const keys = this.getKeys(args)
      for (const key of keys) {
        promises.push(this.redis.lLen(key))
      }
      const results = await Promise.all(promises)
      return this._toResult(results)
    }
  }

  async get(...args) {
    if (args) {
      const keys = this.getKeys(args)
      // const pipe = this.redis.pipeline()

      const promises = []
      for (const key of keys) {
        // promises.push(await (promisify(this.redis.rpush).bind(this.redis))(key, value))
        promises.push(this.redis.lRange(key, 0, -1))
        // pipe.lrange(key, 0, -1)
      }
      // var results = pipe.execute()
      var results = await Promise.all(promises) // pipe.execute()
      // results = (map(this.data_type, items)) for items in results
      return this._toResult(results)
    }
  }

  flush(args) {
    if (args) {
      const keys = this.getKeys(args)
      // this.redis.delete(...keys)
      this.redis.del(keys)
    }

  }
}