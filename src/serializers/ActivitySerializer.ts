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
      activity.serializationId, 
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
    const parts = serializedActivity.split(',')

    console.log('parts', parts);
    // convert these to ids
    const [serializationId, actorId, verbId, objectId, targetId] = parts
    const activity_datetime = epochToDatetime(parseFloat(parts[4]))  // epochToDatetime(parseFloat(parts[4]))// activityTime
    const pickleString = parts[5] // context



    var context = {}
    if (pickleString && pickleString != 'NaN' && pickleString != 'undefined' && pickleString != 'null') {
      context = JSON.parse(pickleString)
    } 
    const activity = new this.ActivityClass({
      serializationId: serializationId,
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