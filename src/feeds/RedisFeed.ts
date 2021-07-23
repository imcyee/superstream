import { ActivitySerializer } from "../serializers/ActivitySerializer"
import { SimpleTimelineSerializer } from "../serializers/SimpleTimelineSerializer"
import { RedisActivityStorage } from "../storage/redis/RedisActivityStorage"
import { RedisTimelineStorage } from "../storage/redis/RedisTimelineStorage"
import { BaseFeed } from "./base/base"

export class RedisFeed extends BaseFeed {

  static TimelineStorageClass = RedisTimelineStorage
  static ActivityStorageClass = RedisActivityStorage
  static ActivitySerializer = ActivitySerializer


  // # : allow you point to a different redis server as specified in
  // # : settings.STREAM_REDIS_CONFIG
  static redis_server = 'default'

  // Returns the options for the timeline storage
  static getTimelineStorageOptions() {
    const options = super.getTimelineStorageOptions()
    const currentOptions = {
      'redis_server': this.redis_server
    }
    return {
      ...options,
      ...currentOptions
    }
  }

  // # : clarify that this feed supports filtering and ordering
  filteringSupported = true
  orderingSupported = true
}