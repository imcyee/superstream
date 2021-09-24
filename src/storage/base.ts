import { Activity } from "../activity/Activity"
import { AggregatedActivity } from "../activity/AggregatedActivity"
import { DummySerializer } from "../serializers/dummy"
import { SimpleTimelineSerializer } from "../serializers/SimpleTimelineSerializer"
import { zip } from "../utils"

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
abstract class BaseStorage {

  // The default serializer class to use
  default_serializer_class = DummySerializer

  // metrics = get_metrics_instance()

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
    this.SerializerClass = SerializerClass || this.default_serializer_class
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
  activities_to_ids(activities_or_ids) {
    const ids = []
    for (const activity_or_id of activities_or_ids)
      ids.push(this.activity_to_id(activity_or_id))
    return ids
  }

  activity_to_id(activity) {
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
    console.log('this.serializer', this.serializer.constructor);
    const serializedActivity = this.serializer.dumps(activity)
    return serializedActivity
  }

  // Serializes the list of activities
  // :param activities: the list of activities 
  serializeActivities(activities) {
    const serializedActivities = {}

    // console.log('before serialized here', activities);
    console.log('before serialized here');

    for (const activity of activities) {
      const serializedActivity = this.serializeActivity(activity)

      const serializationId = this.activity_to_id(activity)
      // console.log('serializationId', serializationId);

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


/**
 * The Activity storage globally stores a key value mapping.
 * This is used to store the mapping between an activityId && the actual
 * activity object.
 * @example
 *     storage = BaseActivityStorage()
 *     storage.addMany(activities)
 *     storage.getMany(activityIds)
 * 
 * The storage specific functions are located in
 * - addToStorage
 * - getFromStorage
 * - removeFromStorage 
 */
export abstract class BaseActivityStorage extends BaseStorage {

  // addToStorage(serializedActivities, *args, ** opts) {
  // Adds the serialized activities to the storage layer 
  // :param serializedActivities: a dictionary with {id: serializedActivity}
  abstract addToStorage(serializedActivities, opts)

  // Retrieves the given activities from the storage layer
  // :param activityIds: the list of activity ids
  // :returns dict: a dictionary mapping activity ids to activities
  abstract getFromStorage(activityIds, opts): Promise<{}>

  // Removes the specified activities
  // :param activityIds: the list of activity ids
  abstract removeFromStorage(activityIds, opts)

  // Gets many activities && deserializes them
  // :param activityIds: the list of activity ids
  // this.metrics.on_feed_read(this.__class__, activityIds?.length) 
  async getMany(activityIds, opts?) {
    const activitiesData = await this.getFromStorage(activityIds, opts)

    return this.deserializeActivities(activitiesData)
  }

  get(activityId, opts) {
    const results = this.getMany([activityId], opts)
    if (!results)
      return null
    else
      return results[0]
  }
  add(activity, opts) {
    return this.addMany([activity], opts)
  }

  // Adds many activities && serializes them before forwarding
  // this to addToStorage 
  // :param activities: the list of activities
  // this.metrics.on_feed_write(this.__class__, activities?.length)
  addMany(activities, opts) {
    const serializedActivities = this.serializeActivities(activities)
 
    return this.addToStorage(serializedActivities, opts)
  }

  remove(activity, opts) {
    return this.removeMany([activity], opts)
  }

  // Figures out the ids of the given activities && forwards
  // The removal to the removeFromStorage function 
  // :param activities: the list of activities 
  // this.metrics.on_feed_remove(this.__class__, (activities).length)
  removeMany(activities, opts) {
    var activityIds
    // if (activities && isinstance(activities[0], (six.string_types, six.integer_types, uuid.UUID))) {
    if (activities && (typeof activities[0] === 'string' || typeof activities[0] === 'number')) {
      activityIds = activities
    } else {
      activityIds = Object.keys(this.serializeActivities(activities))
    }
    return this.removeFromStorage(activityIds, opts)
  }
}

/**
 * The Timeline storage class handles the feed/timeline sorted part of storing
 * a feed.
 * @example
 *     storage = BaseTimelineStorage()
 *     storage.addMany(key, activities)
 *     // get a sorted slice of the feed
 *     storage.getSlice(key, start, stop)
 *     storage.removeMany(key, activities)
 * 
 * The storage specific functions are located in  
 */
export abstract class BaseTimelineStorage extends BaseStorage {

  default_serializer_class = SimpleTimelineSerializer

  add(key, activity, opts) {
    return this.addMany(key, [activity], opts)
  }

  // Adds the activities to the feed on the given key
  // (The serialization is done by the serializer class)
  // :param key: the key at which the feed is stored
  // :param activities: the activities which to store
  addMany(
    key,
    activities,
    opts
  ) {
    // this.metrics.on_feed_write(this.__class__, activities?.length) 
    console.log('@addMany serialize', activities);
    const serializedActivities = this.serializeActivities(activities)
    console.log('@addMany serializedActivities', serializedActivities);
    return this.addToStorage(
      key,
      serializedActivities,
      opts
    )
  }

  abstract addToStorage(
    key,
    serializedActivities,
    opts
  ): Promise<any[]>

  remove(key, activity, opts) {
    return this.removeMany(key, [activity], opts)
  }

  // Removes the activities from the feed on the given key
  // (The serialization is done by the serializer class)
  // :param key: the key at which the feed is stored
  // :param activities: the activities which to remove
  removeMany(key, activities, opts) {
    // this.metrics.on_feed_remove(this.__class__, activities.length)

    var serializedActivities = {}
    if (activities
      && (typeof activities[0] === 'string' || typeof activities[0] === 'number')
    ) {
      for (const a of activities) {
        serializedActivities[a] = a
      }

    } else {
      serializedActivities = this.serializeActivities(activities)
    }

    return this.removeFromStorage(key, serializedActivities, opts)
  }

  abstract getIndexOf(key, activityId)

  abstract removeFromStorage(key, serializedActivities, ...opts)

  // Returns activity's index within a feed or raises ValueError if not present
  // :param key: the key at which the feed is stored
  // :param activityId: the activity's id to search
  indexOf(key, activity_or_id) {
    const activityId = this.activities_to_ids([activity_or_id])[0]
    return this.getIndexOf(key, activityId)
  }

  // :param key: the key at which the feed is stored
  // :param start: start
  // :param stop: stop
  // :returns list: Returns a list with tuples of key,value pairs
  abstract getSliceFromStorage({
    key,
    start,
    stop,
    filterKwargs,
    orderingArgs
  }): Promise<any[]>

  // Returns a sorted slice from the storage
  // :param key: the key at which the feed is stored
  async getSlice({
    key,
    start,
    stop,
    filterKwargs = null,
    orderingArgs = null
  }) {
    const activities_data = await this.getSliceFromStorage({
      key,
      start,
      stop,
      filterKwargs,
      orderingArgs
    })

    var activities = []
    if (activities_data) {
      const serializedActivities = (zip(...activities_data))[1]// list(zip(...activities_data))[1]

      activities = this.deserializeActivities(serializedActivities)
    }


    // this.metrics.on_feed_read(this.__class__, activities?.length)
    return activities
  }

  // Returns a context manager which ensure all subsequent operations
  // Happen via a batch interface
  // An example is redis.map
  abstract getBatchInterface()

  // Trims the feed to the given length
  // :param key: the key location
  // :param length: the length to which to trim
  abstract trim(key, maxLength)

  abstract count(key, opts?)

  abstract delete(key, opts?)
}