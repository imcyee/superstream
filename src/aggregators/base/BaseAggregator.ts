import { Activity } from "../../activity/Activity"
import { AggregatedActivity } from "../../activity/AggregatedActivity"
import { DuplicateActivityException, ValueError } from "../../errors"

/**
 * Base aggregator class
 * Aggregators implement the combining of multiple activities into aggregated activities.
 * The two most important methods are
 * aggregate and merge
 * Aggregate takes a list of activities and turns it into a list of aggregated activities
 * Merge takes two lists of aggregated activities and returns a list of new and changed aggregated activities
 */
export abstract class BaseAggregator {

  AggregatedActivityClass = AggregatedActivity
  ActivityClass = Activity

  // :param AggregatedActivityClass: the class which we should use
  // for returning the aggregated activities
  constructor(
    AggregatedActivityClass = null,
    ActivityClass = null
  ) {
    if (AggregatedActivityClass)
      this.AggregatedActivityClass = AggregatedActivityClass
    if (ActivityClass)
      this.ActivityClass = ActivityClass
  }

  /** 
   * @param activities 
   * @returns  
   * :param activties: A list of activities
   * :returns list: A list of aggregated activities
   * Runs the group activities (using get group)
   * Ranks them using the giving ranking function
   * And returns the sorted activities
   * **Example** ::
   *     aggregator = ModulusAggregator()
   *     activities = [Activity(1), Activity(2)]
   *     aggregatedActivities = aggregator.aggregate(activities)
   */
  aggregate(activities) {
    const aggregateDict = this.groupActivities(activities)
    const aggregatedActivities = Object.values(aggregateDict)
    const ranked_aggregates = this.rank(aggregatedActivities)
    return ranked_aggregates
  }


  // :param aggregated: A list of aggregated activities
  // :param activities: A list of the new activities
  // :returns tuple: Returns new, changed
  // Merges two lists of aggregated activities and returns the new aggregated
  // activities and a from, to mapping of the changed aggregated activities
  // **Example** ::
  //     aggregator = ModulusAggregator()
  //     activities = [Activity(1), Activity(2)]
  //     aggregatedActivities = aggregator.aggregate(activities)
  //     activities = [Activity(3), Activity(4)]
  //     new, changed = aggregator.merge(aggregatedActivities, activities)
  //     for activity in new:
  //         print activity
  //     for from, to in changed:
  //         print 'changed from %s to %s' % (from, to)
  //  dict([('sape', 4139), ('guido', 4127), ('jack', 4098)])  
  // const currentActivitiesDict = dict([(a.group, a) for a in aggregated])
  merge(aggregated, activities) {
    var currentActivitiesDict = {}

    for (const a of aggregated) {
      currentActivitiesDict[a.group] = a
    }

    const latest = []
    const changed = []
    const newAggregated = this.aggregate(activities)

    for (const aggregated of newAggregated) {
      if (!Object.keys(currentActivitiesDict).includes(aggregated.group)) {
        latest.push(aggregated)
      } else {
        const current_aggregated = currentActivitiesDict[aggregated.group]
        const newAggregated = JSON.parse(JSON.stringify(current_aggregated)) //deepcopy(current_aggregated)
        for (const activity of aggregated.activities) {
          try {
            newAggregated.push(activity)
          } catch (e) {
            throw new DuplicateActivityException()
          }
        }
        if (current_aggregated.activities != newAggregated.activities) {
          changed.push([current_aggregated, newAggregated])
        }
      }
    }

    return {
      latest,
      changed,
      deleted: []
      // empty: []
    }
  }

  // Groups the activities based on their group
  // Found by running getGroup(actvity on them) 
  groupActivities(activities) {
    const aggregateDict = {} // dict()
    // # make sure that if we aggregated multiple activities
    // # they end up in serializationId desc in the aggregated activity
    // activities = list(activities) 

    activities = activities.sort((activityA, activityB) => {
      return (activityA.serializationId > activityB.serializationId) ? 1 : -1
    })

    for (const activity of activities) {
      const group = this.getGroup(activity)
      if (!(group in aggregateDict)) {
        aggregateDict[group] = new this.AggregatedActivityClass(group)
      }
      aggregateDict[group].append(activity)
    }
    return aggregateDict
  }

  // // Returns a group to stick this activity in 
  // getGroup(activity): string {
  //   throw new ValueError('not implemented')
  // }
  // Returns a group to stick this activity in 
  abstract getGroup(activity): string
  // {
  //   throw new ValueError('not implemented')
  // }

  // The ranking logic, for sorting aggregated activities 
  abstract rank(aggregatedActivities): AggregatedActivity[]
  // {
  //   throw new ValueError('not implemented')
  // }
}

