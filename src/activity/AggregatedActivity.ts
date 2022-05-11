import createDebug from 'debug'
import { ActivityNotFound, DuplicateActivityException, ValueError } from "../errors"
import { datetimeToEpoch, hashCode, make_list_unique } from "../utils"
import { Activity } from "./Activity"
import { BaseActivity } from "./base/BaseActivity"


const debug = createDebug('superstream:aggregatedActivity')
/**
 * to store aggregated activities
 */
export class AggregatedActivity extends BaseActivity {

  maxAggregatedActivitiesLength = 15
  group
  activities
  created_at
  updated_at
  seen_at
  read_at
  minimizedActivities
  _activityIds
  dehydrated

  constructor(
    group,
    activities = null,
    created_at = null,
    updated_at = null
  ) {
    super()
    this.group = group
    this.activities = activities || []
    this.created_at = created_at
    this.updated_at = updated_at
    // # if the user opened the notification window and browsed over the
    // # content
    this.seen_at = null
    // # if the user engaged with the content
    this.read_at = null
    // # activityFalse
    this.minimizedActivities = 0
    this.dehydrated = false
    this._activityIds = []
  }

  // @property
  // serializationId is used to keep items locally sorted and unique
  // (eg. used redis sorted sets' score or cassandra column names)
  // serializationId is also used to select random activities from the feed
  // (eg. remove activities from feeds must be fast operation)
  // for this reason the serializationId should be unique and not change over time
  // eg:
  // activity.serializationId = 1373266755000000000042008
  // 1373266755000 activity creation time as epoch with millisecond resolution
  // 0000000000042 activity left padded objectId (10 digits)
  // 008 left padded activity verb id (3 digits)
  // :returns: int --the serialization id
  get serializationId() {
    const milliseconds = (Number(datetimeToEpoch(this.updated_at)) * 1000).toString()
    return milliseconds
  }

  // returns the dehydrated version of the current activity
  getDehydated() {
    if (this.dehydrated)
      throw new ValueError('already dehydrated')

    this._activityIds = []
    for (const activity of this.activities)
      this._activityIds.push(activity.serializationId)

    this.activities = []
    this.dehydrated = true
    return this
  }

  // expects activities to be a dict like this {'activityId': Activity}
  getHydrated(activities) {
    if (!this.dehydrated)
      throw new Error('not dehydrated yet')
    for (const activityId of this._activityIds) {
      this.activities.push(activities[activityId])
    }
    this._activityIds = []
    this.dehydrated = false
    return this
  }

  // Works on both hydrated and not hydrated activities
  get length() {
    return this._activityIds.length
      ? this.activityIds?.length
      : this.activities?.length
  }


  // Returns a list of activity ids
  get activityIds(): string[] {
    return this._activityIds.length
      ? this._activityIds
      : this.activities.map(a => a.serializationId)
  }

  // replace with valueOf || primitive
  isEqual(other) {
    if ((other instanceof AggregatedActivity)) {
      throw new ValueError('I can only compare aggregated activities to other aggregated activities')
    }
    var equal = true
    const dateFields = ['created_at', 'updated_at', 'seen_at', 'read_at']
    for (const field of dateFields) {
      const current = this[field] //  getattr(field)
      const other_value = other[field] // getattr(other, field)
      if (typeof current === 'number' && typeof other_value === 'number') {
        const delta = Math.abs(current - other_value)
        const t = new Date()
        if (delta > t.setSeconds(t.getSeconds() + 10)) {
          equal = false
          break
        } else {
          if (current != other_value) {
            equal = false
            break
          }
        }
      }
    }

    if (this.activities != other.activities) {
      equal = false
    }

    return equal
  }

  __hash__() {
    return hashCode(this.serializationId)
  }

  // Checks if activity is present in this aggregated
  contains(activity: Activity) {
    if (!(activity instanceof Activity) && typeof activity !== 'number' && typeof activity !== 'string') {
      throw new ValueError(`contains needs an activity or long not ${activity}`)
    }
    const activityId = activity.serializationId
    const found = this.activities.find(a => a.serializationId === activityId)
    debug('Aggregated contain this activity: ', found);
    return found
    // return activityId in set([a.serializationId for a in this.activities])
  }


  append<T extends Activity>(activity: T) {

    if (this.contains(activity)) {
      throw new DuplicateActivityException()
    }

    // # append the activity
    this.activities.push(activity)

    // # set the first seen
    if (!this.created_at) {
      this.created_at = activity.time
    }

    // # set the last seen
    if (!this.updated_at || activity.time > this.updated_at) {
      this.updated_at = activity.time
    }

    // # ensure that our memory usage, and pickling overhead don't go up
    // # endlessly
    if (this.activities?.length > this.maxAggregatedActivitiesLength) {
      this.activities.pop(0)
      this.minimizedActivities += 1
    }

  }

  remove(activity) {
    if (!this.contains(activity)) {
      throw new ActivityNotFound()
    }

    if (this.activities?.length == 1) {
      throw new ValueError('removing this activity would leave an empty aggregation')
    }
    // # remove the activity
    const activityId = activity?.serializationId
    this.activities = this.activities.filter(a => a.serializationId != activityId)

    // # now time to update the times
    this.updated_at = this.last_activity.time

    // # adjust the count
    if (this.minimizedActivities) {
      this.minimizedActivities -= 1
    }
  }

  removeMany(activities) {
    const removed_activities = []
    for (const activity of activities) {
      try {
        this.remove(activity)
        removed_activities.push(activity)
      } catch (err) {
        throw new ActivityNotFound()
      }
    }
    return removed_activities
  }

  // @property
  // Returns a count of the number of actors
  // When dealing with large lists only approximate the number of actors
  get actor_count(): number {
    var base = this.minimizedActivities
    var actor_id_count = this.actor_ids?.length
    base += actor_id_count
    return base
  }

  // @property
  get other_actor_count() {
    var actor_count = this.actor_count
    return (actor_count - 1)
  }

  // @property
  // Returns the number of activities
  get activity_count() {
    var base = this.minimizedActivities
    base += this.activities?.length || 0
    return base
  }

  // @property
  get last_activity() {
    const activity = this.activities[-1]
    return activity
  }

  // @property
  get last_activities() {
    const activities = this.activities[this.activities.length - 1] // this.activities[:: -1]
    return activities
  }

  // @property
  get verb() {
    return this.activities[0].verb
  }

  // @property
  get verbs() {
    this.activities.map(a => a.verb)
    return make_list_unique(this.activities.map(a => a.verb))
  }

  // @property
  get actor_ids() {
    return make_list_unique(this.activities.map(a => a.actorId))
  }

  // @property
  get object_ids() {
    return make_list_unique(this.activities.map(a => a.objectId))
  }

  // Returns if the activity should be considered as seen at this moment
  is_seen() {
    const seen = this.seen_at && this.seen_at >= this.updated_at
    return seen
  }

  // A hook method that updates the seen_at to current date
  update_seen_at() {
    this.seen_at = Date.now()
  }

  // Returns if the activity should be considered as seen at this moment
  is_read() {
    const read = this.read_at && this.read_at >= this.updated_at
    return read
  }

  // A hook method that updates the read_at to current date
  update_read_at() {
    this.read_at = Date.now()
  }

  // /**
  //  * Inspect only part of the data instead of all the noise
  //  * @example
  //  * call `console.log(util.inspect(my_object));` || `console.log(my_object);` to inspect the data
  //  * Inspect only part of the data instead of all the noise
  //  * @returns 
  //  */
  // [util.inspect.custom]() {
  //   var message
  //   if (this.dehydrated) {
  //     message = `Dehydrated AggregatedActivity (${this._activityIds})`
  //     return message
  //   }
  //   console.log(this.verbs);
  //   // const verbs = this.verbs?.map((v) => v.past_tense) // [v.past_tense for v in this.verbs]
  //   const actor_ids = this.actor_ids
  //   const object_ids = this.object_ids
  //   // const actors = ','.join(map(str, actor_ids))
  //   const actors = actor_ids.join(',')
  //   // message = `AggregatedActivity(${this.group}-${verbs.join(',')}) Actors ${actors}: Objects ${object_ids}`
  //   message = `AggregatedActivity(${this.group}) Actors ${actors}: Objects ${object_ids}`
  //   return message
  // }
}
