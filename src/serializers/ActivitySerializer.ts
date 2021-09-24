import { datetimeToEpoch, epochToDatetime } from "../utils"
import { BaseSerializer } from "./BaseSerializer"


// Serializer optimized for taking as little memory as possible to store an
// Activity
// Serialization consists of 5 parts
// - actorId
// - verbId
// - objectId
// - targetId
// - extraContext (pickle)
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
    const extraContext = Object.assign({}, activity.extraContext) // activity.extraContext.copy()
    var pickleString = ''
    if (Object.keys(extraContext).length) {
      pickleString = JSON.stringify(activity.extraContext)
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

    var extraContext = {}
    if (pickleString) {
      extraContext = JSON.parse(pickleString)
    }
    console.log(this.ActivityClass);
    const activity = new this.ActivityClass({
      actor: actorId,
      verb: verbId, // verb,
      object: objectId,
      target: targetId === 'null' ? null : targetId,
      time: activity_datetime,
      extraContext
    })
    return activity
  }
}