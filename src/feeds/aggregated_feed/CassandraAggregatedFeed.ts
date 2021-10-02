import { Mixin } from "ts-mixer";
import { CassandraAggregatedActivitySerializer } from "../../serializers/cassandra/CassandraAggregatedSerializer";
import { CassandraActivityStorage } from "../../storage/cassandra/CassandraActivityStorage";
import { CassandraFeed } from "../cassandra";
import { AggregatedFeed } from "./AggregatedFeed";

// export class CassandraAggregatedFeed extends Mixin(CassandraFeed, AggregatedFeed) {
export class CassandraAggregatedFeed extends Mixin(CassandraFeed, AggregatedFeed) {
  static ActivityStorageClass = CassandraActivityStorage
  // static
  static TimelineSerializer = CassandraAggregatedActivitySerializer
  timelineClassFamilyName = 'aggregated'
  // timeline_model = models.AggregatedActivity
}