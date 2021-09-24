import { CassandraActivitySerializer } from "../serializers/cassandra/CassandraActivitySerializer"
import { CassandraActivityStorage } from "../storage/cassandra/CassandraActivityStorage"
import { models } from "../storage/cassandra/models"
import { CassandraTimelineStorage } from "../storage/cassandra/CassandraTimelineStorage"
import { BaseFeed } from "./base/base"
import createDebug from 'debug'


// Apache Cassandra feed implementation
// This implementation does not store activities in a
// denormalized fashion
// Activities are stored completely in the timeline storage
export class CassandraFeed extends BaseFeed {

  static ActivityStorageClass = CassandraActivityStorage
  static TimelineStorageClass = CassandraTimelineStorage
  static TimelineSerializer = CassandraActivitySerializer
  static timeline_model = models.Activity

  // # ; the name of the column family
  static timeline_cf_name = 'feeds' // 'example'

  // # : clarify that this feed supports filtering and ordering
  filteringSupported = true
  orderingSupported = true

  // Returns the options for the timeline storage
  static getTimelineStorageOptions() {
    const options = super.getTimelineStorageOptions()
    options['modelClass'] = this.timeline_model
    options['hosts'] = ['192.168.0.146:9046'] // settings.STREAM_CASSANDRA_HOSTS
    options['column_family_name'] = this.timeline_cf_name
    return options
  }

}