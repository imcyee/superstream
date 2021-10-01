// from stream_framework.feeds.aggregated_feed.base import AggregatedFeed
// from stream_framework.feeds.cassandra import CassandraFeed
// from stream_framework.serializers.cassandra.aggregated_activity_serializer import \
//     CassandraAggregatedActivitySerializer
// from stream_framework.storage.cassandra.activityStorage import CassandraActivityStorage
// from stream_framework.storage.cassandra import models
//
// 
// class CassandraAggregatedFeed(AggregatedFeed, CassandraFeed):
//     ActivityStorageClass = CassandraActivityStorage
//     TimelineSerializer = CassandraAggregatedActivitySerializer
//     timeline_cf_name = 'aggregated'
//     timeline_model = models.AggregatedActivity

import { Mixin } from "ts-mixer";
import { CassandraAggregatedActivitySerializer } from "../../serializers/cassandra/CassandraAggregatedSerializer";
import { CassandraActivityStorage } from "../../storage/cassandra/CassandraActivityStorage"
import { CassandraFeed } from "../cassandra";
import { AggregatedFeed } from "./AggregatedFeed";

// export class CassandraAggregatedFeed extends Mixin(CassandraFeed, AggregatedFeed) {
  export class CassandraAggregatedFeed extends AggregatedFeed {
  static ActivityStorageClass = CassandraActivityStorage
  // static
  static TimelineSerializer = CassandraAggregatedActivitySerializer
  timeline_cf_name = 'aggregated'
  // timeline_model = models.AggregatedActivity
}