import { AggregatedActivity } from "../activity/AggregatedActivity"
import { BaseAggregator } from "./BaseAggregator"
import dayjs from 'dayjs'
import { Mixin } from 'ts-mixer'

class RecentRank {
  // The ranking logic, for sorting aggregated activities
  // aggregatedActivities.sort(key = lambda a: a.updated_at, reverse = True)
  rank(aggregatedActivities): AggregatedActivity[] {
    aggregatedActivities.sort((a, b) => {
      return (a.updated_at > b.updated_at) ? 1 : -1
    })
    return aggregatedActivities
  }
}

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

export class RecentVerbAggregator extends Mixin(BaseAggregator, RecentRank) {
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
