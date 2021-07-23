import { BaseActivity } from "./BaseActivity"

/** 
 * The dehydrated verions of an :class:`Activity`.
 * the only data stored is serializationId of the original
 * Serializers can store this instead of the full activity
 * Feed classes
 * 
 * usecase: redis stores serializationId instead of the whole activity
 */
export class DehydratedActivity extends BaseActivity {

  serializationId
  _activityIds
  dehydrated

  constructor(serializationId) {
    super()
    this.serializationId = serializationId
    this._activityIds = [serializationId]
    this.dehydrated = true
  }

  // returns the full hydrated Activity from activities
  // :param activities a dict {'activityId': Activity}
  getHydrated(activities) {
    const activity = activities[this.serializationId]
    activity.dehydrated = false
    return activity
  }
}
