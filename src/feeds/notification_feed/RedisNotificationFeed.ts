import { RedisListsStorage } from "../../storage/redis/RedisListsStorage"
import { RedisTimelineStorage } from "../../storage/redis/RedisTimelineStorage"
import { BaseNotificationFeed } from "./BaseNotificationFeed"

export class RedisNotificationFeed extends BaseNotificationFeed {
  get MarkersStorageClass() { return RedisListsStorage }
  static TimelineStorageClass = RedisTimelineStorage
 

  // static ActivityStorageClass = RedisActivityStorage
}

