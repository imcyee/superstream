import { datetime_to_epoch, epoch_to_datetime } from "../utils"
import { get_verb_by_id } from "../verbs/utils"
import { BaseSerializer } from "./base"

export class ActivitySerializer extends BaseSerializer {

  // '''
  // Serializer optimized for taking as little memory as possible to store an
  // Activity

  // Serialization consists of 5 parts
  // - actor_id
  // - verb_id
  // - object_id
  // - target_id
  // - extra_context (pickle)

  // null values are stored as 0
  // '''

  dumps(activity) {
    this.check_type(activity)
    // keep the milliseconds
    const activity_time = datetime_to_epoch(activity.time).toFixed(6) // '%.6f' % datetime_to_epoch(activity.time)
    const parts = [
      activity.actor_id,
      activity.verb.id,
      activity.object_id,
      activity.target_id || 0
    ]
    const extra_context = activity.extra_context.copy()
    var pickle_string = ''
    // if (extra_context) {
    //   pickle_string = pickle.dumps(activity.extra_context)
    //   if (six.PY3) {
    //     pickle_string = pickle_string.decode('latin1')
    //   }
    // }
    if (extra_context) {
      pickle_string = JSON.stringify(activity.extra_context)
      // if (six.PY3) {
      //   pickle_string = pickle_string.decode('latin1')
      // }
    }
    parts.push(activity_time)
    parts.push(pickle_string)
    // [activity_time, pickle_string]
    const serialized_activity = parts.join // ','.join(map(str, parts))
    return serialized_activity
  }

  loads(serialized_activity) {

    console.log("loading activity");
    // const parts = serialized_activity.split(',', 5)
    const parts = serialized_activity.split(',')
    // convert these to ids
    const [actor_id, verb_id, object_id, target_id] = parts
    const activity_datetime = epoch_to_datetime(parseFloat(parts[4]))  // epoch_to_datetime(parseFloat(parts[4]))// activity_time
    const pickle_string = parts[5]

    // if (!target_id) {
    //   target_id = null
    // }
    const verb = get_verb_by_id(verb_id)
    var extra_context = {}
    if (pickle_string) {
      // if (six.PY3) {
      //   pickle_string = pickle_string.encode('latin1')
      // }
      // extra_context = pickle.loads(pickle_string)
      extra_context = JSON.parse(pickle_string)
    }
    const activity = new this.activity_class({
      actor_id,
      verb,
      object_id,
      target_id,
      time: activity_datetime,
      extra_context: extra_context
    })

    return activity
  }
}