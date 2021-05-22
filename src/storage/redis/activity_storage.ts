import { ActivitySerializer } from "../../serializers/activity_serializer"
import { BaseActivityStorage } from "../base"
import { ShardedHashCache } from "./structures/hash"

class ActivityCache extends ShardedHashCache {
  key_format = 'activity:cache:%s'
}

class RedisActivityStorage extends BaseActivityStorage {
  default_serializer_class = ActivitySerializer

  get_key() {
    return this.options.get('key', 'global')
  }

  get_cache() {
    const key = this.get_key()
    return new ActivityCache(key)
  }

  get_from_storage(activity_ids, kwargs) {
    const cache = this.get_cache()
    var activities = cache.get_many(activity_ids)


    // activities = dict((k, six.text_type(v)) for k, v of activities.items() if v)


    return activities
  }

  add_to_storage(serialized_activities, kwargs) {
    const cache = this.get_cache()
    const key_value_pairs = serialized_activities.items()
    const result = cache.set_many(key_value_pairs)
    var insert_count = 0
    if (result) {
      insert_count = (key_value_pairs).length
    }
    return insert_count
  }

  remove_from_storage(activity_ids, kwargs) {
    // # we never explicitly remove things from storage
    const cache = this.get_cache()
    const result = cache.delete_many(activity_ids)
    return result
  }

  flush() {
    const cache = this.get_cache()
    cache.delete()
  }

}