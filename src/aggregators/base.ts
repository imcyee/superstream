import { AggregatedActivity } from "../activity/AggregatedActivity"
import { applyMixins } from "../utils/applyMixins"
import { BaseAggregator } from "./BaseAggregator"
import dayjs from 'dayjs'

// Needed for all mixins
type Constructor<T = {}> = new (...args: any[]) => T;

function RecentVerb<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    /**
     * Returns a group based on the day and verb 
     */
    getGroup(activity) {
      const verb = activity.verbId
      const date = dayjs(activity.time).format('YYYY-MM-DD')
      const group = `${verb}-${date}` // '%s-%s' % (verb, date)
      return group
    }
  };
}

function Notification<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    getGroup(activity) {
      // Returns a group based on the verb, object and day 
      const verb = activity.verbId
      const objectId = activity.objectId
      const date = dayjs(activity.time).format('YYYY-MM-DD')
      const group = `${verb}-${objectId}-${date}` // '%s-%s-%s' % (verb, objectId, date)
      return group
    }
  };
}

function RecentRank<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    // The ranking logic, for sorting aggregated activities
    // aggregatedActivities.sort(key = lambda a: a.updated_at, reverse = True)
    rank(aggregatedActivities): AggregatedActivity[] {
      aggregatedActivities.sort((a, b) => {
        return (a.updated_at > b.updated_at) ? 1 : -1
      })
      return aggregatedActivities
    }
  };
}

export const RecentVerbAggregator = RecentRank(RecentVerb(BaseAggregator))
export const NotificationAggregator = RecentRank(Notification(BaseAggregator))


/**
 * Mixin pattern source: https://basarat.gitbook.io/typescript/type-system/mixins
 */

// // Most recently updated aggregated activities are ranked first.
// class RecentRankMixin {

//   // The ranking logic, for sorting aggregated activities
//   // aggregatedActivities.sort(key = lambda a: a.updated_at, reverse = True)
//   rank(aggregatedActivities): AggregatedActivity[] {
//     aggregatedActivities.sort((a, b) => {
//       return a.updated_at > b.updated_at
//     })
//     return aggregatedActivities
//   }
// }

// // Aggregates based on the same verb and same time period 
// export class RecentVerbAggregator {
//   getGroup(activity) {
//     const verb = activity.verb.id
//     const date = activity.time.date()
//     // Returns a group based on the day and verb 
//     const group = `${verb}-${date}` // '%s-%s' % (verb, date)
//     return group
//   }
// }

// // Aggregates based on the same verb, object and day 
// export class NotificationAggregator {
//   getGroup(activity) {
//     const verb = activity.verb.id
//     const objectId = activity.objectId
//     const date = activity.time.date()
//     // Returns a group based on the verb, object and day 
//     const group = `${verb}-${objectId}-${date}` // '%s-%s-%s' % (verb, objectId, date)
//     return group
//   }
// }

// export interface RecentVerbAggregator extends RecentRankMixin, BaseAggregator { }
// export interface NotificationAggregator extends RecentRankMixin, BaseAggregator { }

// // Apply the mixins into the base class via
// // the JS at runtime
// applyMixins(RecentVerbAggregator, [RecentRankMixin, BaseAggregator]);
// applyMixins(NotificationAggregator, [RecentRankMixin, BaseAggregator])

