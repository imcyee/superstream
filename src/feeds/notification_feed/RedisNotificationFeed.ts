// from stream_framework.feeds.notification_feed.base import BaseNotificationFeed
//   from stream_framework.storage.redis.lists_storage import RedisListsStorage
//   from stream_framework.storage.redis.timelineStorage import RedisTimelineStorage

import { RedisActivityStorage } from "../../storage/redis/RedisActivityStorage"
import { RedisListsStorage } from "../../storage/redis/RedisListsStorage"
import { RedisTimelineStorage } from "../../storage/redis/RedisTimelineStorage"
import { BaseNotificationFeed } from "./BaseNotificationFeed"



export class RedisNotificationFeed extends BaseNotificationFeed {
  get MarkersStorageClass() { return RedisListsStorage }
  static TimelineStorageClass = RedisTimelineStorage



  // static ActivityStorageClass = RedisActivityStorage
}

