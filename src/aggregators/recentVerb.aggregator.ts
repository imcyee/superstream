import dayjs from "dayjs"
import { Mixin } from "ts-mixer"
import { BaseAggregator } from "./base/BaseAggregator"
import { RecentRank } from "./base/recentRank"

export class RecentVerbAggregator extends Mixin(BaseAggregator, RecentRank) {
// export class RecentVerbAggregator extends RecentRank {
  /**
   * Returns a group based on the day and verb 
   */
  getGroup(activity) {
    const verb = activity.verbId
    const date = dayjs(activity.time).format('YYYY-MM-DD')
    const group = `${verb}-${date}` // '%s-%s' % (verb, date)
    return group
  }
}
