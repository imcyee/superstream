import { Activity } from ".."
import { ActivitySerializer } from "../serializers/ActivitySerializer"
import { RedisActivityStorage } from "../storage/redis/RedisActivityStorage"
import { RedisTimelineStorage } from "../storage/redis/RedisTimelineStorage"
import { BaseFeed } from "./base/base"

export class RedisFeed extends BaseFeed {

  ['timelineStorage']: RedisTimelineStorage //  BaseTimelineStorage // | RedisTimelineStorage
  ['activityStorage']: RedisActivityStorage 
  ["getItem"]: <T extends Activity> (start: number, stop?: number, step?: number) => Promise<T[]>;
  ['addMany']: <T extends Activity>(activities: T[], optsArg?) => Promise<number>
  ['add']: <T extends Activity> (activity: T, kwargs?: { batchInterface?, trim?: boolean }) => Promise<any>
  ['insertActivity']: <T extends Activity> (activity: T, opts?) => Promise<any>
  ['insertActivities']: <T extends Activity> (activities: T[], opts?) => Promise<any>

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