import { Activity, AggregatedActivity } from "../activity"
import { NotImplementedError } from "../errors"
import { BaseSerializer } from "../serializers/base"
import { DummySerializer } from "../serializers/dummy"
import { SimpleTimelineSerializer } from "../serializers/simple_timeline_serializer"
import { zip } from "../utils"

abstract class BaseStorage {
  // '''
  // The feed uses two storage classes, the
  // - Activity Storage && the
  // - Timeline Storage

  // The process works as follows::

  //     feed = BaseFeed()
  //     # the activity storage is used to store the activity && mapped to an id
  //     feed.insert_activity(activity)
  //     # now the id is inserted into the timeline storage
  //     feed.add(activity)

  // Currently there are two activity storage classes ready for production:

  // - Cassandra
  // - Redis

  // The storage classes always receive a full activity object.
  // The serializer class subsequently determines how to transform the activity
  // into something the database can store.
  // '''
  // #: The default serializer class to use
  default_serializer_class = DummySerializer
  // metrics = get_metrics_instance()

  activity_class = Activity
  aggregated_activity_class = AggregatedActivity


  serializer_class
  options

  constructor({
    serializer_class = null,
    activity_class = null,
    ...options
  }) {
    // '''
    // :param serializer_class: allows you to overwrite the serializer class
    // '''
    this.serializer_class = serializer_class || this.default_serializer_class
    this.options = options
    if (activity_class) {
      this.activity_class = activity_class
    }
    const aggregated_activity_class = options?.aggregated_activity_class // options.pop('aggregated_activity_class', null)
    if (aggregated_activity_class)
      this.aggregated_activity_class = aggregated_activity_class
  }

  // Flushes the entire storage
  flush() { }

  // Utility function for lower levels to chose either serialize 
  activities_to_ids(activities_or_ids) {
    const ids = []
    for (const activity_or_id of activities_or_ids)
      ids.push(this.activity_to_id(activity_or_id))
    return ids
  }
  activity_to_id(activity) {
    return activity?.serialization_id
  }

  // @property
  get serializer() {
    // Returns an instance of the serializer class
    // The serializer needs to know about the activity &&
    // aggregated activity classes we're using
    const serializer_class = this.serializer_class
    const kwargs = {}
    if (this.aggregated_activity_class) {
      kwargs['aggregated_activity_class'] = this.aggregated_activity_class
    }
    const serializer_instance = new serializer_class({
      activity_class: this.activity_class,
      ...kwargs
    })

    return serializer_instance
  }

  serialize_activity(activity) {
    // Serialize the activity && returns the serialized activity
    // :returns str: the serialized activity
    const serialized_activity = this.serializer.dumps(activity)
    return serialized_activity
  }

  serialize_activities(activities) {
    // Serializes the list of activities
    // :param activities: the list of activities 
    const serialized_activities = {}
    for (const activity of activities) {
      const serialized_activity = this.serialize_activity(activity)
      serialized_activities[this.activity_to_id(activity)] = serialized_activity
    }
    return serialized_activities
  }

  deserialize_activities(serialized_activities) {
    // Serializes the list of activities
    // :param serialized_activities: the list of activities
    // :param serialized_activities: a dictionary with activity ids && activities
    const activities = []

    // # handle the case where this is a dict
    if (serialized_activities instanceof Object && !Array.isArray(serialized_activities)) {
      serialized_activities = Object.values(serialized_activities)
    }
    if (serialized_activities) {
      for (const serialized_activity of serialized_activities) {
        const activity = this.serializer.loads(serialized_activity)
        activities.push(activity)
      }
    }
    return activities
  }
}


export class BaseActivityStorage extends BaseStorage {

  // The Activity storage globally stores a key value mapping.
  // This is used to store the mapping between an activity_id && the actual
  // activity object.

  // **Example**::

  //     storage = BaseActivityStorage()
  //     storage.add_many(activities)
  //     storage.get_many(activity_ids)

  // The storage specific functions are located in

  // - add_to_storage
  // - get_from_storage
  // - remove_from_storage 

  // add_to_storage(serialized_activities, *args, ** kwargs) {
  add_to_storage(serialized_activities, kwargs) {
    // Adds the serialized activities to the storage layer 
    // :param serialized_activities: a dictionary with {id: serialized_activity}
    throw new NotImplementedError()
  }
  async get_from_storage(activity_ids, kwargs): Promise<{}> {
    // Retrieves the given activities from the storage layer
    // :param activity_ids: the list of activity ids
    // :returns dict: a dictionary mapping activity ids to activities
    throw new NotImplementedError()
  }
  remove_from_storage(activity_ids, kwargs) {
    // Removes the specified activities
    // :param activity_ids: the list of activity ids
    throw new NotImplementedError()
  }
  async get_many(activity_ids, kwargs?) {
    // Gets many activities && deserializes them
    // :param activity_ids: the list of activity ids
    // this.metrics.on_feed_read(this.__class__, activity_ids?.length) 
    const activities_data = await this.get_from_storage(activity_ids, kwargs)
    // console.log('activities_data', activities_data);
    return this.deserialize_activities(activities_data)
  }

  get(activity_id, kwargs) {
    const results = this.get_many([activity_id], kwargs)
    if (!results)
      return null
    else
      return results[0]
  }
  add(activity, kwargs) {
    return this.add_many([activity], kwargs)
  }

  add_many(activities, kwargs) {
    // Adds many activities && serializes them before forwarding
    // this to add_to_storage 
    // :param activities: the list of activities
    // this.metrics.on_feed_write(this.__class__, activities?.length)
    const serialized_activities = this.serialize_activities(activities)
    return this.add_to_storage(serialized_activities, kwargs)
  }

  remove(activity, kwargs) {
    return this.remove_many([activity], kwargs)
  }

  remove_many(activities, kwargs) {
    // Figures out the ids of the given activities && forwards
    // The removal to the remove_from_storage function 
    // :param activities: the list of activities 
    // this.metrics.on_feed_remove(this.__class__, (activities).length)
    var activity_ids
    // if (activities && isinstance(activities[0], (six.string_types, six.integer_types, uuid.UUID))) {
    if (activities && (typeof activities[0] === 'string' || typeof activities[0] === 'number')) {
      activity_ids = activities
    } else {
      activity_ids = Object.keys(this.serialize_activities(activities))
    }
    return this.remove_from_storage(activity_ids, kwargs)
  }
}

export class BaseTimelineStorage extends BaseStorage {
  // The Timeline storage class handles the feed/timeline sorted part of storing
  // a feed.
  // **Example**::
  //     storage = BaseTimelineStorage()
  //     storage.add_many(key, activities)
  //     # get a sorted slice of the feed
  //     storage.get_slice(key, start, stop)
  //     storage.remove_many(key, activities)
  // The storage specific functions are located in  
  default_serializer_class = SimpleTimelineSerializer

  add(key, activity, kwargs) {
    return this.add_many(key, [activity], kwargs)
  }

  add_many(
    key,
    activities,
    kwargs
  ) {
    // '''
    // Adds the activities to the feed on the given key
    // (The serialization is done by the serializer class)

    // :param key: the key at which the feed is stored
    // :param activities: the activities which to store
    // '''
    // this.metrics.on_feed_write(this.__class__, activities?.length)
    const serialized_activities = this.serialize_activities(activities)

    return this.add_to_storage(
      key,
      serialized_activities,
      kwargs
    )
  }

  async add_to_storage(
    key,
    serialized_activities,
    kwargs
  ): Promise<any[]> {
    throw new NotImplementedError("Not implemented")
  }

  remove(key, activity, kwargs) {
    return this.remove_many(key, [activity], kwargs)
  }

  remove_many(key, activities, kwargs) {
    // '''
    // Removes the activities from the feed on the given key
    // (The serialization is done by the serializer class)

    // :param key: the key at which the feed is stored
    // :param activities: the activities which to remove
    // '''
    // this.metrics.on_feed_remove(this.__class__, activities.length)

    var serialized_activities = {}
    if (activities
      && (typeof activities[0] === 'string' || typeof activities[0] === 'number')
    ) {
      for (const a of activities) {
        serialized_activities[a] = a
      }

    } else {
      serialized_activities = this.serialize_activities(activities)
    }
    console.log(serialized_activities);
    return this.remove_from_storage(key, serialized_activities, kwargs)
  }

  get_index_of(key, activity_id) {
    throw new NotImplementedError()
  }
  remove_from_storage(key, serialized_activities, ...kwargs) {
    throw new NotImplementedError()
  }
  index_of(key, activity_or_id) {
    // '''
    // Returns activity's index within a feed or raises ValueError if not present

    // :param key: the key at which the feed is stored
    // :param activity_id: the activity's id to search
    // '''
    const activity_id = this.activities_to_ids([activity_or_id])[0]
    return this.get_index_of(key, activity_id)
  }

  async get_slice_from_storage({
    key,
    start,
    stop,
    filter_kwargs,
    ordering_args
  }): Promise<any[]> {
    // '''
    // :param key: the key at which the feed is stored
    // :param start: start
    // :param stop: stop
    // :returns list: Returns a list with tuples of key,value pairs
    // '''
    throw new NotImplementedError()
  }

  async get_slice({
    key,
    start,
    stop,
    filter_kwargs = null,
    ordering_args = null
  }) {
    // '''
    // Returns a sorted slice from the storage

    // :param key: the key at which the feed is stored
    // '''
    const activities_data = await this.get_slice_from_storage({
      key,
      start,
      stop,
      filter_kwargs,
      ordering_args
    })
    var activities = []
    if (activities_data) {
      const serialized_activities = (zip(...activities_data))[1]// list(zip(...activities_data))[1]
      activities = this.deserialize_activities(serialized_activities)
    }
    // this.metrics.on_feed_read(this.__class__, activities?.length)
    return activities
  }
  get_batch_interface() {
    // '''
    // Returns a context manager which ensure all subsequent operations
    // Happen via a batch interface

    // An example is redis.map
    // '''
    throw new NotImplementedError()
  }
  trim(key, max_length) {
    // '''
    // Trims the feed to the given length

    // :param key: the key location
    // :param length: the length to which to trim
    // '''
  }
  count(key, kwargs?) {
    throw new NotImplementedError()
  }
  delete(key, kwargs?) {
    throw new NotImplementedError()
  }
}