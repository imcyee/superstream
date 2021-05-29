// from stream_framework import settings
// from stream_framework.feeds.base import BaseFeed
// from stream_framework.storage.cassandra.activity_storage import CassandraActivityStorage
// from stream_framework.storage.cassandra.timeline_storage import CassandraTimelineStorage
// from stream_framework.serializers.cassandra.activity_serializer import CassandraActivitySerializer
// from stream_framework.storage.cassandra import models

import { CassandraActivitySerializer } from "../serializers/cassandra/activity_serializer"
import { CassandraActivityStorage } from "../storage/cassandra/activity_storage"
import { models } from "../storage/cassandra/models"
import { CassandraTimelineStorage } from "../storage/cassandra/timeline_storage"
import { BaseFeed } from "./base"


export class CassandraFeed extends BaseFeed {

  // """
  // Apache Cassandra feed implementation
  // This implementation does not store activities in a
  // denormalized fashion
  // Activities are stored completely in the timeline storage
  // """

  static activity_storage_class = CassandraActivityStorage
  static timeline_storage_class = CassandraTimelineStorage
  static timeline_serializer = CassandraActivitySerializer
  static timeline_model = models.Activity

  // # ; the name of the column family
  static timeline_cf_name = 'feeds' // 'example'

  // # : clarify that this feed supports filtering and ordering
  filtering_supported = true
  ordering_supported = true

  // @classmethod
  static get_timeline_storage_options() {
    // '''
    // Returns the options for the timeline storage
    // '''
    const options = super.get_timeline_storage_options()
    options['modelClass'] = this.timeline_model
    options['hosts'] = ['192.168.0.146:9046'] // settings.STREAM_CASSANDRA_HOSTS
    options['column_family_name'] = this.timeline_cf_name
    return options
  }

}