import { datetimeToEpoch, epochToDatetime } from "../utils"
import { BaseSerializer } from "./BaseSerializer"


// Serializer optimized for taking as little memory as possible to store an
// Activity
// Serialization consists of 5 parts
// - actorId
// - verbId
// - objectId
// - targetId
// - context (pickle)
// null values are stored as 0
export class ActivitySerializer extends BaseSerializer {

  dumps(activity) {
    this.checkType(activity)
    // keep the milliseconds
    const activityTime = datetimeToEpoch(activity.time).toFixed(6) // '%.6f' % datetimeToEpoch(activity.time)
    const parts = [
      activity.actorId,
      activity.verbId, // activity.verb.id,
      activity.objectId,
      activity.targetId || 'null'
    ]
    const context = Object.assign({}, activity.context) // activity.context.copy()
    var pickleString = ''
    if (Object.keys(context).length) {
      pickleString = JSON.stringify(activity.context)
      parts.push(pickleString)
    }
    parts.push(activityTime)

    // [activityTime, pickleString]
    const serializedActivity = parts.join(',')
    return serializedActivity
  }

  loads(serializedActivity) {
    console.log('inside serializer', serializedActivity);
    const parts = serializedActivity.split(',')

    // convert these to ids
    const [actorId, verbId, objectId, targetId] = parts
    const activity_datetime = epochToDatetime(parseFloat(parts[4]))  // epochToDatetime(parseFloat(parts[4]))// activityTime
    const pickleString = parts[5]

    var context = {}
    if (pickleString) {
      context = JSON.parse(pickleString)
    }
    console.log(this.ActivityClass);
    const activity = new this.ActivityClass({
      actor: actorId,
      verb: verbId, // verb,
      object: objectId,
      target: targetId === 'null' ? null : targetId,
      time: activity_datetime,
      context
    })
    return activity
  }
}