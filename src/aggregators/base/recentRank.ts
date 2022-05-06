import { AggregatedActivity } from "../../activity/AggregatedActivity"

 
export abstract class RecentRank {
  // The ranking logic, for sorting aggregated activities
  // aggregatedActivities.sort(key = lambda a: a.updated_at, reverse = True)
  rank(aggregatedActivities): AggregatedActivity[] {
    aggregatedActivities.sort((a, b) => {
      return (a.updated_at > b.updated_at) ? 1 : -1
    })
    return aggregatedActivities
  }
}

