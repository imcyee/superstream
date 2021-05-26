// from stream_framework.feeds.base import BaseFeed
// from stream_framework.storage.redis.activity_storage import RedisActivityStorage
// from stream_framework.storage.redis.timeline_storage import RedisTimelineStorage
// from stream_framework.serializers.activity_serializer import ActivitySerializer

import { ActivitySerializer } from "../serializers/activity_serializer"
import { RedisActivityStorage } from "../storage/redis/activity_storage"
import { RedisTimelineStorage } from "../storage/redis/timeline_storage"
import { BaseFeed } from "./base"


export class RedisFeed extends BaseFeed {
  static timeline_storage_class = RedisTimelineStorage
  static activity_storage_class = RedisActivityStorage

  static activity_serializer = ActivitySerializer

  // # : allow you point to a different redis server as specified in
  // # : settings.STREAM_REDIS_CONFIG
  static redis_server = 'default'

  // @classmethod
  static get_timeline_storage_options() {
    // '''
    // Returns the options for the timeline storage
    // '''
    // const options = super(RedisFeed, cls).get_timeline_storage_options()
    const options = super.get_timeline_storage_options()
    options['redis_server'] = this.redis_server
    return options
  }

  // # : clarify that this feed supports filtering and ordering
  filtering_supported = true
  ordering_supported = true
}