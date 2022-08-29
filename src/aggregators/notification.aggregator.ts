import dayjs from "dayjs"
import { Mixin } from "ts-mixer"
import { BaseAggregator } from "./base/BaseAggregator"
import { RecentRank } from "./base/recentRank"

export class NotificationAggregator extends Mixin(BaseAggregator, RecentRank) {
  /**
   * This will group notification by the same object, verb and same day
   * @param activity 
   * @returns 
   */
  getGroup(activity) {
    // Returns a group based on the verb, object and day 
    const verbId = activity.verbId
    const objectId = activity.objectId
    const date = dayjs(activity.time).format('YYYY-MM-DD')
    console.log(activity.time, date, verbId, objectId);
    const group = `${verbId}-${objectId}-${date}` // '%s-%s-%s' % (verb, objectId, date)
    return group
  }
}