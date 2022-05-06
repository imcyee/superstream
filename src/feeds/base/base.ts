import { Activity } from "../../activity/Activity"
import { AssertionError } from "../../errors"
import { ActivitySerializer } from "../../serializers/ActivitySerializer"
import { BaseSerializer } from "../../serializers/BaseSerializer"
import { SimpleTimelineSerializer } from "../../serializers/SimpleTimelineSerializer"
import { BaseActivityStorage } from "../../storage/base/base_activity_storage"
import { BaseTimelineStorage } from "../../storage/base/base_timeline_storage"

/**
 * The feed class allows you to add and remove activities from a feed.
 * Please find below a quick usage example.
 * 
 * @example
 *     feed = BaseFeed(userId)
 *     // start by adding some existing activities to a feed
 *     feed.addMany([activities])
 *     // querying results
 *     results = feed.getItems(0,10)
 *     // removing activities
 *     feed.removeMany([activities])
 *     // counting the number of items in the feed
 *     count = feed.count()
 *     feed.delete()
 * @description
 * The feed is easy to subclass.
 * Commonly you'll want to change the maxLength and the keyFormat.
 * Subclassing
 * @example
 *     class MyFeed(BaseFeed){
 *         keyFormat = 'user_feed:%(userId)s'
 *         maxLength = 1000
 * Filtering and Pagination
 * @example
 *     feed.filter(activity_id__gte=1)[:10]
 *     feed.filter(activity_id__lte=1)[:10]
 *     feed.filter(activity_id__gt=1)[:10]
 *     feed.filter(activity_id__lt=1)[:10]
 * 
 * @description
 * Activity storage and Timeline storage
 * To keep reduce timelines memory utilization the BaseFeed supports
 * normalization of activity data.
 * The full activity data is stored only in the activityStorage while the timeline
 * only keeps a activity references (refered as activityId in the code)
 * For this reason when an activity is created it must be stored in the activityStorage
 * before other timelines can refer to it
 * @example
 *     feed = BaseFeed(userId)
 *     feed.insertActivity(activity)
 *     follower_feed = BaseFeed(follower_userId)
 *     feed.add(activity)
 * 
 * @description
 * It is also possible to store the full data in the timeline storage
 * The strategy used by the BaseFeed depends on the serializer utilized by the timelineStorage
 * When activities are stored as dehydrated (just references) the BaseFeed will query the
 * activityStorage to return full activities
 * @example
 *     feed = BaseFeed(userId)
 *     feed[:10]
 * 
 * @description
 * gets the first 10 activities from the timelineStorage, if the results are not complete activities then
 * the BaseFeed will hydrate them via the activityStorage
 */
export abstract class BaseFeed {

  /** 
   * the format of the key used when storing the data
   * @param userId 
   * @returns 
   */
  keyFormat(userId) { return `feed_${userId}` }

  // the max length after which we start trimming
  get maxLength() { return 100 }

  /**
   * the activity class to use
   */
  static ActivityClass = Activity

  /**
   * the activity storage class to use (Redis, Cassandra etc)
   */
  static ActivityStorageClass = BaseActivityStorage

  /**
   * the timeline storage class to use (Redis, Cassandra etc)
   */
  static TimelineStorageClass = BaseTimelineStorage

  /**
   * the class the activity storage should use for serialization
   */
  static ActivitySerializer = BaseSerializer

  /**
   * the class the timeline storage should use for serialization
   */
  static TimelineSerializer = SimpleTimelineSerializer

  // the chance that we trim the feed, the goal is not to keep the feed
  // at exactly max length, but make sure we don't grow to infinite size :)
  trimChance = 0.01

  // if we can use .filter calls to filter on things like activity id
  filteringSupported = false
  orderingSupported = false

  /**
   * userId: the id of the user who's feed we're working on
   */
  userId
  key
  timelineStorage: BaseTimelineStorage // | RedisTimelineStorage
  activityStorage: BaseActivityStorage
  _filterKwargs
  _orderingArgs

  constructor(userId: string) {
    if (!userId)
      throw new Error(`userId must be defined, userId: ${userId}`)

    this.userId = userId
    this.key = this.keyFormat(this.userId)

    this.timelineStorage = (this.constructor as typeof BaseFeed).getTimelineStorage()
    this.activityStorage = (this.constructor as typeof BaseFeed).getActivityStorage()

    // ability to filter and change ordering(not supported for all backends)
    this._filterKwargs = {}
    this._orderingArgs = [] // tuple()
  }

  // Returns the options for the timeline storage
  static getTimelineStorageOptions() {
    const options = {
      'SerializerClass': this.TimelineSerializer,
      'ActivityClass': this.ActivityClass
    }
    return options
  }


  // Returns an instance of the timeline storage
  static getTimelineStorage() {
    const options = this.getTimelineStorageOptions()
    // @ts-ignore
    const timelineStorage = new this.TimelineStorageClass(options)
    // const timelineStorage = Reflect.construct(this.TimelineStorageClass, [options])
    return timelineStorage
  }


  // Returns an instance of the activity storage
  static getActivityStorage() {
    const options = {
      'SerializerClass': this.ActivitySerializer,
      'ActivityClass': this.ActivityClass
    }
    var activityStorage
    if (this.ActivityStorageClass) {
      // @ts-ignore
      activityStorage = new this.ActivityStorageClass(options) // cls.ActivityStorageClass(** options)
    }
    return activityStorage
  }


  // Inserts an activity to the activity storage
  // @param activity: the activity class
  static async insertActivities(activities, opts?) {
    const activityStorage = this.getActivityStorage()
    if (activityStorage)
      return await activityStorage.addMany(activities, opts)
  }


  // Inserts an activity to the activity storage
  // @param activity: the activity class
  static async insertActivity(activity, opts?) {
    return await this.insertActivities([activity], opts)
  }


  // Removes an activity from the activity storage
  // @param activity: the activity class or an activity id
  static removeActivity(activity, opts?) {
    const activityStorage = this.getActivityStorage()
    activityStorage.remove(activity, opts)
  }


  static getTimelineBatchInterface() {
    const timelineStorage = this.getTimelineStorage()
    return timelineStorage.getBatchInterface()
  }

  async add(
    activity,
    kwargs?: {
      batchInterface?,
      trim?: boolean,
    }
  ) {
    return await this.addMany([activity], kwargs)
  }

  // Add many activities
  // // @param activities: a list of activities
  // // @param batchInterface: the batch interface
  // 
  async addMany(
    activities,
    optsArg?
  ): Promise<number> {
    const {
      batchInterface = null,
      trim = true,
      ...opts
    } = optsArg || {}

    const addCount = await this.timelineStorage.addMany(
      this.key,
      activities,
      {
        batchInterface,
      }
    )
    // # trim the feed sometimes
    if (trim && Math.random() <= this.trimChance) {
      this.trim()
    }
    this.onUpdateFeed({ newInserted: activities, deleted: [] })
    return addCount
  }

  async remove(activityId, kwargs = {}) {
    return await this.removeMany([activityId], kwargs)
  }

  // Remove many activities
  // @param activityIds: a list of activities or activity ids
  async removeMany(
    activityIds: string[],
    {
      batchInterface = null,
      trim = true,
      ...kwargs
    }
  ) {
    const delCount = await this.timelineStorage.removeMany(
      this.key,
      activityIds,
      {
        batchInterface,
        ...kwargs
      }
      // kwargs
    )
    // # trim the feed sometimes
    if (trim && Math.random() <= this.trimChance)
      this.trim()
    this.onUpdateFeed({
      newInserted: [],
      deleted: activityIds
    })
    return delCount
  }

  // A hook called when activities area created or removed from the feed
  onUpdateFeed({ newInserted, deleted }) { }

  // Trims the feed to the length specified
  // @param length: the length to which to trim the feed, defaults to this.maxLength
  async trim(length = null) {
    length = length || this.maxLength
    await this.timelineStorage.trim(this.key, length)
  }

  // Count the number of items in the feed
  async count() {
    return await this.timelineStorage.count(this.key)
  }

  __len__ = this.count

  // Delete the entire feed
  async delete() {
    return await this.timelineStorage.delete(this.key)
  }


  static flush() {
    const activityStorage = this.getActivityStorage()
    const timelineStorage = this.getTimelineStorage()
    activityStorage.flush()
    timelineStorage.flush()
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
  //     results = this.getActivitySlice(start, bound)
  //   } catch (err) {
  //     // except StopIteration:
  //     // # There's nothing left, even though the bound is higher.
  //     results = null
  //   }
  //   return results
  // }


  // Retrieves an item or slice from the set of results.
  async getItem(
    start: number = 0,
    stop?: number,
    step?: number
  ) {
    if (!start && !stop) {
      throw new TypeError("Missing start/stop")
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
      results = await this.getActivitySlice(start, bound)
    } catch (err) {
      // except StopIteration:
      // # There's nothing left, even though the bound is higher.
      results = null
      console.error(err);
    }
    return results
  }

  // Returns the index of the activity id
  // @param activityId: the activity id
  indexOf(activityId) {
    return this.timelineStorage.indexOf(this.key, activityId)
  }


  /**
   * hydrates the activities using the activityStorage
   */
  async hydrateActivities(activities) {
    // const activityIds = activities.map((a) => a._activityIds)
    const activityIds = []
    activities.forEach(a => activityIds.push(...a._activityIds))

    const activityList = await this.activityStorage.getMany(activityIds)

    var activityData = {}
    for (const a of activityList) {
      activityData[a.serializationId] = a
    }

    const hydratedActivities = []
    for (const activity of activities) {
      const hydrated_activity = await activity.getHydrated(activityData)
      hydratedActivities.push(hydrated_activity)
    }
    return hydratedActivities
    // return [activity.getHydrated(activityData) for activity of activities]
  }

  // checks if the activities are dehydrated
  needsHydration(activities) {
    const found = activities.find(a => a?.dehydrated)
    return found
  }

  // Gets activityIds from timelineStorage and then loads the
  // actual data querying the activityStorage
  async getActivitySlice(
    start = null,
    stop = null,
    rehydrate = true
  ) {
    var activities = await this.timelineStorage.getSlice({
      key: this.key,
      start,
      stop,
      filterKwargs: this._filterKwargs,
      orderingArgs: this._orderingArgs
    })

    if (this.needsHydration(activities) && rehydrate) {
      activities = await this.hydrateActivities(activities)
    }

    return activities
  }

  // Copy the feed instance
  _clone() {
    // const feedCopy = copy.copy(this)
    const feedCopy = Object.assign(
      Object.create(Object.getPrototypeOf(this)),
      this
    )
    // const filterKwargs = copy.copy(this._filterKwargs)
    const filterKwargs = Object.assign(
      Object.create(Object.getPrototypeOf(this._filterKwargs)),
      this._filterKwargs
    )

    feedCopy._filterKwargs = filterKwargs
    return feedCopy
  }

  // Filter based on the kwargs given, uses django orm like syntax
  // **Example** ::
  //     # filter between 100 and 200
  //     feed = feed.filter(activity_id__gte=100)
  //     feed = feed.filter(activity_id__lte=200)
  //     # the same statement but in one step
  //     feed = feed.filter(activity_id__gte=100, activity_id__lte=200)
  filter(kwargs) {
    const newClone = this._clone()
    newClone._filterKwargs.update(kwargs)
    return newClone
  }

  // Change default ordering
  order_by(...orderingArgs) {
    const newClone = this._clone()
    newClone._orderingArgs = orderingArgs
    return newClone
  }
}
