import { ActivitySerializer } from "../../serializers/ActivitySerializer"
import { AggregatedActivitySerializer } from "../../serializers/AggregatedActivitySerializer"
import { RedisActivityStorage } from "../../storage/redis/RedisActivityStorage"
import { RedisTimelineStorage } from "../../storage/redis/RedisTimelineStorage"
import { AggregatedFeed } from "./AggregatedFeed"

export class RedisAggregatedFeed extends AggregatedFeed {
  static TimelineSerializer = AggregatedActivitySerializer
  static ActivitySerializer = ActivitySerializer
  static TimelineStorageClass = RedisTimelineStorage
  static ActivityStorageClass = RedisActivityStorage
}

