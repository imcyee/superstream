import { Activity } from "../../activity/Activity"
import { AggregatedActivity } from "../../activity/AggregatedActivity"
import { getMetricsInstance } from "../../metrics/node_statsd"
import { DummySerializer } from "../../serializers/dummy"

/**
 * The feed uses two storage classes,
 * - Activity Storage
 * - Timeline Storage
 * 
 * The process works as follows:
 * 
 * @example
 *    feed = BaseFeed()
 *    // the activity storage is used to store the activity && mapped to an id
 *    feed.insertActivity(activity)
 *    // now the id is inserted into the timeline storage
 *    feed.add(activity)
 * 
 * Currently there are two activity storage classes ready for production:
 * - Cassandra
 * - Redis
 *
 * The storage classes always receive a full activity object.
 * The serializer class subsequently determines how to transform the activity
 * into something the database can store.
 */
export abstract class BaseStorage {

  // The default serializer class to use
  DefaultSerializerClass = DummySerializer

  metrics = getMetricsInstance()

  ActivityClass = Activity

  AggregatedActivityClass = AggregatedActivity

  // :param SerializerClass: allows you to overwrite the serializer class
  SerializerClass

  options

  constructor({
    SerializerClass = null,
    ActivityClass = null,
    ...options
  }) {
    this.SerializerClass = SerializerClass || this.DefaultSerializerClass
    this.options = options
    if (ActivityClass) {
      this.ActivityClass = ActivityClass
    }
    const AggregatedActivityClass = options?.AggregatedActivityClass // options.pop('AggregatedActivityClass', null)
    if (AggregatedActivityClass)
      this.AggregatedActivityClass = AggregatedActivityClass
  }

  // Flushes the entire storage
  abstract flush() // { }

  // Utility function for lower levels to chose either serialize 
  activitiesToIds(activities_or_ids) {
    const ids = []
    for (const activity_or_id of activities_or_ids)
      ids.push(this.activityToId(activity_or_id))
    return ids
  }

  activityToId(activity) {
    return activity?.serializationId
  }

  // @property
  // Returns an instance of the serializer class
  // The serializer needs to know about the activity &&
  // aggregated activity classes we're using
  get serializer() {
    const SerializerClass = this.SerializerClass
    const opts = {}
    if (this.AggregatedActivityClass) {
      opts['AggregatedActivityClass'] = this.AggregatedActivityClass
    }
    const serializerInstance = new SerializerClass({
      ActivityClass: this.ActivityClass,
      ...opts
    })

    return serializerInstance
  }

  // Serialize the activity && returns the serialized activity
  // :returns str: the serialized activity
  serializeActivity(activity) {
    const serializedActivity = this.serializer.dumps(activity)
    return serializedActivity
  }

  // Serializes the list of activities
  // :param activities: the list of activities 
  serializeActivities(activities): {
    [activityId: string]: [activityPayload: any]
  } {
    const serializedActivities = {}

    for (const activity of activities) {
      const serializedActivity = this.serializeActivity(activity)

      const serializationId = this.activityToId(activity)

      // there will be collision if serializationId is generated at the same time
      serializedActivities[serializationId] = serializedActivity
    }
    // console.log('serialized here', serializedActivities);
    return serializedActivities
  }

  // Serializes the list of activities
  // :param serializedActivities: the list of activities
  // :param serializedActivities: a dictionary with activity ids && activities
  deserializeActivities(serializedActivities) {
    const activities = []

    // # handle the case where this is a dict
    if (serializedActivities instanceof Object && !Array.isArray(serializedActivities)) {
      serializedActivities = Object.values(serializedActivities)
    }
    if (serializedActivities) {
      for (const serializedActivity of serializedActivities) {
        const activity = this.serializer.loads(serializedActivity)
        activities.push(activity)
      }
    }
    return activities
  }
}

