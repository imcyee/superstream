import dayjs from "dayjs"
import { Mixin } from "ts-mixer"
import { BaseAggregator } from "./base/BaseAggregator"
import { RecentRank } from "./base/recentRank"

export class NotificationAggregator extends Mixin(BaseAggregator, RecentRank) {
  getGroup(activity) {
    // Returns a group based on the verb, object and day 
    const verb = activity.verbId
    const objectId = activity.objectId
    const date = dayjs(activity.time).format('YYYY-MM-DD')
    const group = `${verb}-${objectId}-${date}` // '%s-%s-%s' % (verb, objectId, date)
    return group
  }
}