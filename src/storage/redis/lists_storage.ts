import { BaseListsStorage } from "../base_lists_storage"
import { get_redis_connection } from "./connection"

export class RedisListsStorage extends BaseListsStorage {
  _redis

  _to_result(results) {
    if (results) {
      if ((results.length) == 1) {
        return results[0]
      } else {
        return [...results]
        // return tuple(results)
      }
    }
  }

  // @property
  get redis() {
    // '''
    // Lazy load the redis connection
    // '''
    try {
      return this._redis
    }
    catch (err) {
      // except AttributeError:
      this._redis = get_redis_connection()
      return this._redis
    }
  }

  get_keys(list_names) {
    const keys = []
    for (const list_name in list_names) {
      keys.push(this.get_key(list_name))
    }
    return keys

    // return [this.get_key(list_name) for list_name in list_names]
  }

  add(kwargs) {
    var pipe
    if (kwargs)
      pipe = this.redis.pipeline()

    for (const k in kwargs) {
      const list_name = k
      const values = kwargs[k]
      // const [list_name, values] = k
      if (values) {
        const key = this.get_key(list_name)
        for (const value of values) {
          pipe.rpush(key, value)
        }
        // # Removes items from list's head
        pipe.ltrim(key, -this.max_length, -1)
      }
    }

    // for (list_name, values in six.iteritems(kwargs)) {
    //   if (values) {
    //     const key = this.get_key(list_name)
    //     for (const value of values) {
    //       pipe.rpush(key, value)
    //     }
    //     // # Removes items from list's head
    //     pipe.ltrim(key, -this.max_length, -1)
    //   }
    // }
    pipe.execute()
  }

  remove(kwargs) {
    if (kwargs) {
      const pipe = this.redis.pipeline()

      for (const k in kwargs) {
        const list_name = k
        const values = kwargs[list_name]

        const key = this.get_key(list_name)
        for (const value in values) {
          // # Removes all occurrences of value in the list
          pipe.lrem(key, 0, value)
        }
      }

      // for (list_name, values in six.iteritems(kwargs)) {
      //   const key = this.get_key(list_name)
      //   for (value in values:) {
      //     // # Removes all occurrences of value in the list
      //     pipe.lrem(key, 0, value)
      //   }
      // }
      pipe.execute()
    }
  }

  count(args) {
    if (args) {
      const keys = this.get_keys(args)
      const pipe = this.redis.pipeline()
      for (const key of keys) {
        pipe.llen(key)
      }
      return this._to_result(pipe.execute())
    }
  }

  get(args) {
    if (args) {
      const keys = this.get_keys(args)
      const pipe = this.redis.pipeline()
      for (const key of keys) {
        pipe.lrange(key, 0, -1)
      }
      var results = pipe.execute()
      // results = (map(this.data_type, items)) for items in results
      return this._to_result(results)
    }
  }

  flush(args) {
    if (args) {
      const keys = this.get_keys(args)
      this.redis.delete(...keys)
    }
  }
}