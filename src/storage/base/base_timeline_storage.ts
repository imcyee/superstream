import { Activity } from "../../activity/Activity"
import { AggregatedActivity } from "../../activity/AggregatedActivity"
import { getMetricsInstance } from "../../metrics/node_statsd"
import { DummySerializer } from "../../serializers/dummy"
import { SimpleTimelineSerializer } from "../../serializers/SimpleTimelineSerializer"
import { zip } from "../../utils"
import { BaseStorage } from "./base_storage"

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

  DefaultSerializerClass = SimpleTimelineSerializer

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
    this.metrics.onFeedWrite(this.constructor.name, activities?.length)
    console.log('before', activities);
    const serializedActivities = this.serializeActivities(activities)
    console.log('serializedActivities', serializedActivities);
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
  ): Promise<any>

  remove(key, activity, opts) {
    return this.removeMany(key, [activity], opts)
  }

  // Removes the activities from the feed on the given key
  // (The serialization is done by the serializer class)
  // :param key: the key at which the feed is stored
  // :param activities: the activities which to remove
  removeMany(key, activities, opts) {
    this.metrics.onFeedRemove(this.constructor.name, activities.length)

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
    const activityId = this.activitiesToIds([activity_or_id])[0]
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


    this.metrics.onFeedRead(this.constructor.name, activities?.length)
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