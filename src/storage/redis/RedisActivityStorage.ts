import { zip } from "lodash"
import { ActivitySerializer } from "../../serializers/ActivitySerializer"
import { BaseActivityStorage } from "../base/base_activity_storage"
import { ShardedHashCache } from "./structures/hash"

class ActivityCache extends ShardedHashCache {
  keyFormat = (s) => `activity:cache:${s}`
}

export class RedisActivityStorage extends BaseActivityStorage {
  DefaultSerializerClass = ActivitySerializer

  getKey() {
    return this.options['key'] || 'global'
  }

  getCache() {
    const key = this.getKey()
    return new ActivityCache(key)
  }

  async getFromStorage(activityIds, kwargs): Promise<any> {
    const cache = this.getCache()
    var activities = await cache.getMany(activityIds)
    return activities
  }

  async addToStorage(serializedActivities, kwargs) {
    const cache = this.getCache()
    const key_value_pairs = zip(Object.keys(serializedActivities), Object.values(serializedActivities))
    const result = await cache.set_many(key_value_pairs)
    var insert_count = 0
    if (result) {
      // should check number of ok in result
      insert_count = (key_value_pairs).length
    }
    console.log("insert_count", insert_count);
    return insert_count
  }

  removeFromStorage(activityIds, kwargs) {
    // # we never explicitly remove things from storage
    const cache = this.getCache()
    const result = cache.delete_many(activityIds)
    return result
  }

  flush() {
    const cache = this.getCache()
    cache.delete()
  }

}