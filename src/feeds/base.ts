import { Activity } from "../activity"
import { AssertionError } from "../errors"
import { BaseSerializer } from "../serializers/base"
import { SimpleTimelineSerializer } from "../serializers/simple_timeline_serializer"
import { BaseActivityStorage, BaseTimelineStorage } from "../storage/base"
import { RedisTimelineStorage } from "../storage/redis/timeline_storage"

export class BaseFeed {

  // '''
  // The feed class allows you to add and remove activities from a feed.
  // Please find below a quick usage example.

  // **Usage Example**::

  //     feed = BaseFeed(user_id)
  //     # start by adding some existing activities to a feed
  //     feed.add_many([activities])
  //     # querying results
  //     results = feed[:10]
  //     # removing activities
  //     feed.remove_many([activities])
  //     # counting the number of items in the feed
  //     count = feed.count()
  //     feed.delete()


  // The feed is easy to subclass.
  // Commonly you'll want to change the max_length and the key_format.

  // **Subclassing**::

  //     class MyFeed(BaseFeed){
  //         key_format = 'user_feed:%(user_id)s'
  //         max_length = 1000


  // **Filtering and Pagination**::

  //     feed.filter(activity_id__gte=1)[:10]
  //     feed.filter(activity_id__lte=1)[:10]
  //     feed.filter(activity_id__gt=1)[:10]
  //     feed.filter(activity_id__lt=1)[:10]


  // **Activity storage and Timeline storage**

  // To keep reduce timelines memory utilization the BaseFeed supports
  // normalization of activity data.

  // The full activity data is stored only in the activity_storage while the timeline
  // only keeps a activity references (refered as activity_id in the code)

  // For this reason when an activity is created it must be stored in the activity_storage
  // before other timelines can refer to it

  // eg. ::

  //     feed = BaseFeed(user_id)
  //     feed.insert_activity(activity)
  //     follower_feed = BaseFeed(follower_user_id)
  //     feed.add(activity)

  // It is also possible to store the full data in the timeline storage

  // The strategy used by the BaseFeed depends on the serializer utilized by the timeline_storage

  // When activities are stored as dehydrated (just references) the BaseFeed will query the
  // activity_storage to return full activities

  // eg. ::

  //     feed = BaseFeed(user_id)
  //     feed[:10]

  // gets the first 10 activities from the timeline_storage, if the results are not complete activities then
  // the BaseFeed will hydrate them via the activity_storage

  // '''
  // the format of the key used when storing the data
  // key_format = 'feed_%(user_id)s'
  key_format(user_id) {
    return `feed_${user_id}`
  }

  // the max length after which we start trimming
  max_length = 100

  // the activity class to use
  static activity_class = Activity

  // the activity storage class to use (Redis, Cassandra etc)
  static activity_storage_class = BaseActivityStorage
  // the timeline storage class to use (Redis, Cassandra etc)
  static timeline_storage_class = BaseTimelineStorage

  // the class the activity storage should use for serialization
  static activity_serializer = BaseSerializer
  // the class the timline storage should use for serialization
  static timeline_serializer = SimpleTimelineSerializer

  // the chance that we trim the feed, the goal is not to keep the feed
  // at exactly max length, but make sure we don't grow to infinite size :)
  trim_chance = 0.01

  // if we can use .filter calls to filter on things like activity id
  filtering_supported = false
  ordering_supported = false


  user_id
  key
  timeline_storage: BaseTimelineStorage | RedisTimelineStorage
  activity_storage: BaseActivityStorage
  _filter_kwargs
  _ordering_args

  constructor({ user_id }) {
    // '''
    // :param user_id: the id of the user who's feed we're working on
    // '''
    this.user_id = user_id
    this.key_format = this.key_format

    this.key = this.key_format(this.user_id) // % { 'user_id': this.user_id }

    this.timeline_storage = (this.constructor as typeof BaseFeed).get_timeline_storage()
    this.activity_storage = (this.constructor as typeof BaseFeed).get_activity_storage()

    // # ability to filter and change ordering(not supported for all
    // # backends)
    this._filter_kwargs = {}
    this._ordering_args = [] // tuple()
  }

  // @classmethod
  static get_timeline_storage_options() {
    // '''
    // Returns the options for the timeline storage
    // '''
    const options = {}
    options['serializer_class'] = this.timeline_serializer
    options['activity_class'] = this.activity_class
    return options
  }

  // @classmethod
  static get_timeline_storage() {
    // '''
    // Returns an instance of the timeline storage
    // '''
    const options = this.get_timeline_storage_options()
    const timeline_storage = new this.timeline_storage_class(options)
    return timeline_storage
  }

  // @classmethod
  static get_activity_storage() {
    // '''
    // Returns an instance of the activity storage
    // '''
    const options = {}
    options['serializer_class'] = this.activity_serializer
    options['activity_class'] = this.activity_class
    var activity_storage
    if (this.activity_storage_class) {
      activity_storage = new this.activity_storage_class(options) // cls.activity_storage_class(** options)
    }
    return activity_storage
  }

  // @classmethod
  static async insert_activities(activities, kwargs) {
    // '''
    // Inserts an activity to the activity storage
    // :param activity: the activity class
    // '''
    const activity_storage = this.get_activity_storage()
    if (activity_storage)
      return await activity_storage.add_many(activities)
  }

  // @classmethod
  static async insert_activity(activity, kwargs?) {
    // '''
    // Inserts an activity to the activity storage
    // :param activity: the activity class
    // '''
    return await this.insert_activities([activity], kwargs)
  }

  // @classmethod
  static remove_activity(activity, kwargs) {
    // '''
    // Removes an activity from the activity storage
    // :param activity: the activity class or an activity id
    // '''
    const activity_storage = this.get_activity_storage()
    activity_storage.remove(activity)
  }

  // @classmethod
  static get_timeline_batch_interface() {
    const timeline_storage = this.get_timeline_storage()
    return timeline_storage.get_batch_interface()
  }

  async add(activity, kwargs?: {
    batch_interface?,
    trim?: boolean,
  }) {
    return await this.add_many([activity], kwargs)
  }

  async add_many(
    activities,
    {
      batch_interface = null,
      trim = true,
      ...kwargs
    } = {}) {
    // '''
    // Add many activities

    // // :param activities: a list of activities
    // // :param batch_interface: the batch interface
    // // '''
    // validate_list_of_strict(activities, (this.activity_class, FakeActivity))
    const add_count = await this.timeline_storage.add_many(
      this.key,
      activities,
      {
        // this is kwargs
        batch_interface,
      }
    )
    // # trim the feed sometimes
    if (trim && Math.random() <= this.trim_chance) {
      this.trim()
    }
    this.on_update_feed({ new_: activities, deleted: [] })
    return add_count
  }

  remove(activity_id, kwargs) {
    return this.remove_many([activity_id], kwargs)
  }
  remove_many(activity_ids, {
    batch_interface = null,
    trim = true,
    ...kwargs
  }) {
    // '''
    // Remove many activities

    // :param activity_ids: a list of activities or activity ids
    // '''
    const del_count = this.timeline_storage.remove_many(
      this.key,
      activity_ids,
      {
        batch_interface,
      }
      // kwargs
    )
    // # trim the feed sometimes
    if (trim && Math.random() <= this.trim_chance)
      this.trim()
    this.on_update_feed({
      new_: [],
      deleted: activity_ids
    })
    return del_count
  }

  on_update_feed({ new_, deleted }) {
    // '''
    // A hook called when activities area created or removed from the feed
    // '''
  }

  trim(length = null) {
    // '''
    // Trims the feed to the length specified

    // :param length: the length to which to trim the feed, defaults to this.max_length
    // '''
    length = length || this.max_length
    this.timeline_storage.trim(this.key, length)
  }

  count() {
    // '''
    // Count the number of items in the feed
    // '''
    return this.timeline_storage.count(this.key)
  }

  __len__ = this.count

  delete() {
    // '''
    // Delete the entire feed
    // '''
    return this.timeline_storage.delete(this.key)
  }

  // @classmethod
  static flush() {
    const activity_storage = this.get_activity_storage()
    const timeline_storage = this.get_timeline_storage()
    activity_storage.flush()
    timeline_storage.flush()
  }

  __iter__() {
    throw new TypeError('Iteration over non sliced feeds is not supported')
  }

  // // unable to use this as this is python specific
  // __getitem__(k) {
  //   // """
  //   // Retrieves an item or slice from the set of results.

  //   // """
  //   if (!(k instanceof slice) && typeof k !== "number") {
  //     throw new TypeError()
  //   }

  //   if ((!(k instanceof slice) && (k >= 0)) || ((k instanceof slice) && (!k.start || k.start >= 0))) {
  //     throw new AssertionError("Negative indexing is not supported.")
  //   }
  //   // assert((not isinstance(k, slice) && (k >= 0)) || (isinstance(k, slice) && (k.start is null or k.start >= 0)
  //   //     && (k.stop is null or k.stop >= 0))), \
  //   // "Negative indexing is not supported."

  //   var start
  //   var bound

  //   if (k instanceof slice) {
  //     start = k.start

  //     if (k.stop) {
  //       bound = parseInt(k.stop)
  //     } else {
  //       bound = null
  //     }
  //   } else {
  //     start = k
  //     bound = k + 1
  //   }

  //   start = start || 0

  //   if (start && bound && (start == bound)) {
  //     return []
  //   }

  //   var results
  //   // # We need check to see if we need to populate more of the cache.
  //   try {
  //     results = this.get_activity_slice(start, bound)
  //   } catch (err) {
  //     // except StopIteration:
  //     // # There's nothing left, even though the bound is higher.
  //     results = null
  //   }
  //   return results
  // }

  // unable to use this as this is python specific
  async get_item(
    start: number = 0,
    stop?: number,
    step?: number
  ) {

    // """
    // Retrieves an item or slice from the set of results.
    // """
    if (!start && !stop) {
      throw new TypeError()
    }

    if ((start < 0) || (stop < 0)) {
      throw new AssertionError("Negative indexing is not supported.")
    }

    // assert((not isinstance(k, slice) && (k >= 0)) || (isinstance(k, slice) && (k.start is null or k.start >= 0)
    //     && (k.stop is null or k.stop >= 0))), \
    // "Negative indexing is not supported."

    // var start
    var bound = start + 1

    if (stop) {
      bound = Number(stop)
    }

    // start = start || 0
    if (start && bound && (start == bound)) {
      return []
    }

    var results
    // # We need check to see if we need to populate more of the cache.
    try {
      results = await this.get_activity_slice(start, bound)
    } catch (err) {
      // except StopIteration:
      // # There's nothing left, even though the bound is higher.
      results = null
      console.error(err);
    }
    return results
  }

  index_of(activity_id) {
    // '''
    // Returns the index of the activity id

    // :param activity_id: the activity id
    // '''
    return this.timeline_storage.index_of(this.key, activity_id)
  }

  async hydrate_activities(activities) {
    // '''
    // hydrates the activities using the activity_storage
    // '''
    const activity_ids = []
    for (const activity of activities) {
      activity_ids.push(...activity._activity_ids)
    }
    const activity_list = await this.activity_storage.get_many(activity_ids)

    // activity_list.forEach(al => console.log(al.serialization_id))
    var activity_data = {}
    for (const a of activity_list) {
      activity_data[a.serialization_id] = a
    }

    // console.log(activity_data);
    const activities2 = [] 
    for (const activity of activities) { 
      const hydrated_activity = await activity.get_hydrated(activity_data)
      activities2.push(hydrated_activity)
    }
    return activities2
    // return [activity.get_hydrated(activity_data) for activity of activities]
  }

  needs_hydration(activities) {
    // '''
    // checks if the activities are dehydrated
    // '''
    const found = activities.find(a => a?.dehydrated)
    return found
  }

  async get_activity_slice(
    start = null,
    stop = null,
    rehydrate = true
  ) {
    // '''
    // Gets activity_ids from timeline_storage and then loads the
    // actual data querying the activity_storage
    // '''
    var activities = await this.timeline_storage.get_slice({
      key: this.key,
      start,
      stop,
      filter_kwargs: this._filter_kwargs,
      ordering_args: this._ordering_args
    })
    if (this.needs_hydration(activities) && rehydrate) {
      activities = await this.hydrate_activities(activities)
    }
    return activities
  }

  _clone() {
    // '''
    // Copy the feed instance
    // '''
    // const feed_copy = copy.copy(this)
    const feed_copy = Object.assign(Object.create(Object.getPrototypeOf(this)), this)
    // const filter_kwargs = copy.copy(this._filter_kwargs)
    const filter_kwargs = Object.assign(Object.create(Object.getPrototypeOf(this._filter_kwargs)), this._filter_kwargs)

    feed_copy._filter_kwargs = filter_kwargs
    return feed_copy
  }

  filter(kwargs) {
    // '''
    // Filter based on the kwargs given, uses django orm like syntax

    // **Example** ::
    //     # filter between 100 and 200
    //     feed = feed.filter(activity_id__gte=100)
    //     feed = feed.filter(activity_id__lte=200)
    //     # the same statement but in one step
    //     feed = feed.filter(activity_id__gte=100, activity_id__lte=200)

    // '''
    const new_ = this._clone()
    new_._filter_kwargs.update(kwargs)
    return new_
  }

  order_by(...ordering_args) {
    // '''
    // Change default ordering

    // '''
    const new_ = this._clone()
    new_._ordering_args = ordering_args
    return new_
  }
}

export class UserBaseFeed extends BaseFeed {

  // '''
  // Implementation of the base feed with a different
  // Key format and a really large max_length
  // '''
  key_format = (user_id) => `user_feed:${user_id}`
  max_length = 10 ** 6
}