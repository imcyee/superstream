import { ActivityNotFound, AttributeError, DuplicateActivityException, ValueError } from "./errors"
import { make_list_unique } from "./utils"

const MAX_AGGREGATED_ACTIVITIES_LENGTH = 15


class BaseActivity {
  // '''
  // Common parent class for Activity and Aggregated Activity
  // Check for this if you want to see if something is an activity
  // ''' 
}

export class DehydratedActivity extends BaseActivity {

  // '''
  // The dehydrated verions of an :class:`Activity`.
  // the only data stored is serialization_id of the original

  // Serializers can store this instead of the full activity
  // Feed classes

  // '''
  serialization_id
  _activity_ids
  dehydrated

  constructor(serialization_id) {
    super()
    this.serialization_id = serialization_id
    this._activity_ids = [serialization_id]
    this.dehydrated = true
  }

  get_hydrated(activities) {
    // '''
    // returns the full hydrated Activity from activities

    // :param activities a dict {'activity_id': Activity}

    // '''
    const activity = activities[parseInt(this.serialization_id)]
    activity.dehydrated = false
    return activity
  }
}

export class Activity extends BaseActivity {

  // '''
  // Wrapper class for storing activities
  // Note

  // actor_id
  // target_id
  // and object_id are always present

  // actor, target and object are lazy by default
  // '''

  verb
  time
  extra_context
  dehydrated
  object_id
  actor_id
  target_id

  constructor(
    actor,
    verb,
    object,
    target = null,
    time = null,
    extra_context = null
  ) {
    super()
    this.verb = verb
    this.time = time || Date.now() // datetime.datetime.utcnow()
    // # either set .actor or .actor_id depending on the data
    this._set_object_or_id('actor', actor)
    this._set_object_or_id('object', object)
    this._set_object_or_id('target', target)
    // # store the extra context which gets serialized
    this.extra_context = extra_context || {}
    this.dehydrated = false
  }

  get_dehydrated() {
    // '''
    // returns the dehydrated version of the current activity

    // '''
    return new DehydratedActivity(this.serialization_id)
  }

  __eq__(other) {
    if (!(other instanceof Activity)) {
      const message = `Can only compare to Activity not ${other} of type ${type(other)}`
      throw new ValueError(message)
    }
    return this.serialization_id == other.serialization_id
  }

  __lt__(other) {
    return this.serialization_id < other.serialization_id
  }

  __hash__() {
    return hash(this.serialization_id)
  }

  // @property
  get serialization_id() {
    // '''
    // serialization_id is used to keep items locally sorted and unique
    // (eg. used redis sorted sets' score or cassandra column names)

    // serialization_id is also used to select random activities from the feed
    // (eg. remove activities from feeds must be fast operation)
    // for this reason the serialization_id should be unique and not change over time

    // eg:
    // activity.serialization_id = 1373266755000000000042008
    // 1373266755000 activity creation time as epoch with millisecond resolution
    // 0000000000042 activity left padded object_id (10 digits)
    // 008 left padded activity verb id (3 digits)

    // :returns: int --the serialization id
    // '''
    if (this.object_id >= 10 ** 10 || this.verb.id >= 10 ** 3) {
      throw new TypeError('Fatal: object_id / verb have too many digits !')
    }
    if (!this.time) {
      throw new TypeError('Cant serialize activities without a time')
    }
    const milliseconds = str(int(datetime_to_epoch(this.time) * 1000))
    const serialization_id_str = '%s%0.10d%0.3d' % (milliseconds, this.object_id, this.verb.id)
    const serialization_id = parseInt(serialization_id_str)
    return serialization_id
  }

  _set_object_or_id(field, object_) {
    // '''
    // Either write the integer to
    // field_id
    // Or if its a real object
    // field_id = int
    // field = object
    // '''
    const id_field = `${field}_id` // '%s_id' % field
    if (Number.isInteger(object_)) {
      this[id_field] = object_
      // setattr(id_field, object_)
    } else if (!object_) {
      this[field] = null
      this[id_field] = null
      // setattr(field, null)
      // setattr(id_field, null)
    } else {
      this[field] = object_
      this[id_field] = object_.id
      // setattr(field, object_)
      // setattr(id_field, object_.id)
    }
  }

  __getattr__(name) {
    // '''
    // Fail early if using the activity class in the wrong way
    // '''
    if (name in ['object', 'target', 'actor']) {
      if (name not in this.__dict__) {
        const error_message = 'Field this.%s is not defined, use this.%s_id instead' % (name, name)
        throw new AttributeError(error_message)
      }
    }
    return object.__getattribute__(name)
  }

  __repr__() {
    const class_name = this.__class__.__name__
    const message = `${class_name}(${this.verb.past_tense}) ${this.actor_id} ${this.object_id}`
    return message
  }
}

export class AggregatedActivity extends BaseActivity {

  // '''
  // Object to store aggregated activities
  // '''
  max_aggregated_activities_length = MAX_AGGREGATED_ACTIVITIES_LENGTH

  group
  activities
  created_at
  updated_at
  seen_at
  read_at
  minimized_activities
  _activity_ids
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
    this.minimized_activities = 0
    this.dehydrated = false
    this._activity_ids = []
  }

  // @property
  get serialization_id() {
    // '''
    // serialization_id is used to keep items locally sorted and unique
    // (eg. used redis sorted sets' score or cassandra column names)

    // serialization_id is also used to select random activities from the feed
    // (eg. remove activities from feeds must be fast operation)
    // for this reason the serialization_id should be unique and not change over time

    // eg:
    // activity.serialization_id = 1373266755000000000042008
    // 1373266755000 activity creation time as epoch with millisecond resolution
    // 0000000000042 activity left padded object_id (10 digits)
    // 008 left padded activity verb id (3 digits)

    // :returns: int --the serialization id
    // '''
    const milliseconds = str(int(datetime_to_epoch(this.updated_at)) * 1000)
    return milliseconds
  }

  get_dehydrated() {
    // '''
    // returns the dehydrated version of the current activity

    // '''
    if (this.dehydrated) {
      throw new ValueError('already dehydrated')
    }
    this._activity_ids = []
    for (const activity of this.activities) {
      this._activity_ids.push(activity.serialization_id)
    }
    this.activities = []
    this.dehydrated = true
    return this
  }

  get_hydrated(activities) {
    // '''
    // expects activities to be a dict like this {'activity_id': Activity}

    // '''
    assert this.dehydrated, 'not dehydrated yet'
    for (const activity_id of this._activity_ids) {
      this.activities.push(activities[activity_id])
    }
    this._activity_ids = []
    this.dehydrated = false
    return this
  }

  __len__() {
    // '''
    // Works on both hydrated and not hydrated activities
    // '''
    // if (this._activity_ids) {
    //   length = len(this.activity_ids)
    // } else {
    //   length = len(this.activities)
    // }
    if (this._activity_ids) {
      length = this.activity_ids?.length
    } else {
      length = this.activities?.length
    }
    return length
  }


  activity_ids() {
    // '''
    // Returns a list of activity ids
    // '''
    var activity_ids
    if (this._activity_ids) {
      activity_ids = this._activity_ids
    }
    else {
      activity_ids = [a.serialization_id for a in this.activities]
    }
    return activity_ids
  }

  // replace with valueOf || primitive
  __eq__(other) {
    if ((other instanceof AggregatedActivity)) {
      throw new ValueError('I can only compare aggregated activities to other aggregated activities')
    }
    var equal = true
    const date_fields = ['created_at', 'updated_at', 'seen_at', 'read_at']
    for (const field of date_fields) {
      const current = getattr(field)
      const other_value = getattr(other, field)
      if (isinstance(current, datetime.datetime) and isinstance(other_value, datetime.datetime)) {
        const delta = abs(current - other_value)
        if (delta > datetime.timedelta(seconds = 10)) {
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
    return hash(this.serialization_id)
  }

  contains(activity) {
    // '''
    // Checks if activity is present in this aggregated
    // '''
    if (!isinstance(activity, (Activity, long_t, uuid.UUID))) {
      throw new ValueError('contains needs an activity or long not %s', activity)
    }
    const activity_id = activity?.serialization_id
    // activity_id = getattr(activity, 'serialization_id', activity)
    return activity_id in set([a.serialization_id for a in this.activities])
  }


  append(activity) {
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
    if (this.activities?.length > this.max_aggregated_activities_length) {
      this.activities.pop(0)
      this.minimized_activities += 1
    }

  }

  remove(activity) {
    if (!this.contains(activity)) {
      // throw new stream_framework_exceptions.ActivityNotFound()
      throw new ActivityNotFound()
    }

    if (this.activities?.length == 1) {
      throw new ValueError('removing this activity would leave an empty aggregation')
    }
    // # remove the activity
    const activity_id = activity?.serialization_id
    this.activities = [a for a in this.activities if a.serialization_id != activity_id]

    // # now time to update the times
    this.updated_at = this.last_activity.time

    // # adjust the count
    if (this.minimized_activities) {
      this.minimized_activities -= 1
    }
  }

  remove_many(activities) {
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
  get actor_count(): number {
    // '''
    // Returns a count of the number of actors
    // When dealing with large lists only approximate the number of actors
    // '''
    var base = this.minimized_activities
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
  get activity_count() {
    // '''
    // Returns the number of activities
    // '''
    var base = this.minimized_activities
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
    const activities = this.activities[:: -1]
    return activities
  }
  // @property
  get verb() {
    return this.activities[0].verb
  }
  // @property
  get verbs() {
    return make_list_unique([a.verb for a in this.activities])
  }
  // @property
  get actor_ids() {
    return make_list_unique([a.actor_id for a in this.activities])
  }
  // @property
  get object_ids() {
    return make_list_unique([a.object_id for a in this.activities])
  }
  is_seen() {
    // '''
    // Returns if the activity should be considered as seen at this moment
    // '''
    const seen = this.seen_at && this.seen_at >= this.updated_at
    return seen
  }
  update_seen_at() {
    // '''
    // A hook method that updates the seen_at to current date
    // '''
    this.seen_at = Date.now()
  }
  is_read() {
    // '''
    // Returns if the activity should be considered as seen at this moment
    // '''
    const read = this.read_at && this.read_at >= this.updated_at
    return read
  }
  update_read_at() {
    // '''
    // A hook method that updates the read_at to current date
    // '''
    this.read_at = Date.now()
  }

  /**
   * this is how python get this when print is called
   * @returns 
   */
  __repr__() {
    var message
    if (this.dehydrated) {
      message = `Dehydrated AggregatedActivity (${this._activity_ids})`
      return message
    }
    const verbs = this.verbs.map((v) => v.past_tense) // [v.past_tense for v in this.verbs]
    const actor_ids = this.actor_ids
    const object_ids = this.object_ids
    // const actors = ','.join(map(str, actor_ids))
    const actors = actor_ids.join(',')
    message = `AggregatedActivity(${this.group}-${verbs.join(',')}) Actors ${actors}: Objects ${object_ids}`
    return message
  }
}

export class NotificationActivity extends AggregatedActivity {
  is_seen
  is_read
  constructor(kwargs) {
    super(kwargs)

    // # overrides AggregatedActivity is_read & is_seen instance methods
    this.is_seen = false
    this.is_read = false
  }
}
