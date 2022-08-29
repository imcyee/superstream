import { CassandraAggregatedActivitySerializer } from "../../serializers/cassandra/CassandraAggregatedSerializer";
import { CassandraActivityStorage } from "../../storage/cassandra/CassandraActivityStorage";
import { CassandraTimelineStorage } from "../../storage/cassandra/CassandraTimelineStorage";
import { models } from "../../storage/cassandra/models";
import { AggregatedFeed } from "./AggregatedFeed";


// export class CassandraAggregatedFeed extends Mixin(CassandraFeed, AggregatedFeed) {
export class CassandraAggregatedFeed extends AggregatedFeed {
  // export class CassandraAggregatedFeed extends AggregatedFeed {

  static ActivityStorageClass = CassandraActivityStorage
  static TimelineSerializer = CassandraAggregatedActivitySerializer
  static timelineClassFamilyName = 'aggregated'

  /**
   * Below are functions from cassandra feed
   */
  static TimelineStorageClass = CassandraTimelineStorage
  // timeline_model = models.AggregatedActivity
  static timeline_model = models.Activity

  // # : clarify that this feed supports filtering and ordering
  filteringSupported = true
  orderingSupported = true

  // Returns the options for the timeline storage
  static getTimelineStorageOptions() {
    const options = super.getTimelineStorageOptions()
    options['modelClass'] = this.timeline_model
    options['hosts'] = ['192.168.0.146:9046'] // settings.STREAM_CASSANDRA_HOSTS
    options['columnFamilyName'] = this.timelineClassFamilyName
    return options
  }
}