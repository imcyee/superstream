import { Activity } from "../../activity/Activity"
import { AggregatedActivity } from "../../activity/AggregatedActivity"
import { DuplicateActivityException } from "../../errors"


/**
 * Base aggregator class
 * Aggregators implement the combining of multiple activities into 
 * aggregated activities.
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
  constructor({
    AggregatedActivityClass = null,
    ActivityClass = null
  }) {
    if (AggregatedActivityClass)
      this.AggregatedActivityClass = AggregatedActivityClass
    if (ActivityClass)
      this.ActivityClass = ActivityClass
  }

  /** 
   * Runs the group activities (using get group)
   * Ranks them using the giving ranking function
   * And returns the sorted activities
   * @example
   *     aggregator = ModulusAggregator()
   *     activities = [Activity(1), Activity(2)]
   *     aggregatedActivities = aggregator.aggregate(activities)
   * @param activities An array of activities
   * @returns An array of aggregated activities
   */
  aggregate<T extends Activity>(activities: T[]) {
    const aggregateDict = this.groupActivities(activities)
    const aggregatedActivities = Object.values(aggregateDict)
    const ranked_aggregates = this.rank(aggregatedActivities)
    return ranked_aggregates
  }


  /** 
   * Merges two lists of aggregated activities and returns the new aggregated
   * activities and a from, to mapping of the changed aggregated activities
   * **Example** ::
   *     aggregator = ModulusAggregator()
   *     activities = [Activity(1), Activity(2)]
   *     aggregatedActivities = aggregator.aggregate(activities)
   *     activities = [Activity(3), Activity(4)]
   *     new, changed = aggregator.merge(aggregatedActivities, activities)
   *     for activity in new:
   *         print activity
   *     for from, to in changed:
   *         print 'changed from %s to %s' % (from, to)
   *  dict([('sape', 4139), ('guido', 4127), ('jack', 4098)])  
   * const currentActivitiesDict = dict([(a.group, a) for a in aggregated])
   * 
   * @param aggregated A list of aggregated activities
   * @param activities A list of the new activities
   * @returns Returns latest, changed, deleted
   */
  merge<T extends AggregatedActivity>(
    aggregated: T[],
    activities
  ) {
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
        const currentAggregated = currentActivitiesDict[aggregated.group]


        //deepcopy(current_aggregated)
        // this is should be a class
        console.log('constructor', currentAggregated.constructor);

        const newAggregated: T = JSON.parse(JSON.stringify(currentAggregated))


        for (const activity of aggregated.activities) {
          try {
            console.log('activity', activity);
            console.log(newAggregated);
            newAggregated.append(activity)
          } catch (e) {
            console.log('e', e);
            throw new DuplicateActivityException()
          }
        }
        // issue with equal
        if (currentAggregated.activities != newAggregated.activities) {
          changed.push([currentAggregated, newAggregated])
        }
      }
    }

    return {
      latest,
      changed,
      deleted: []
    }
  }

  // Groups the activities based on their group
  // Found by running getGroup(actvity on them) 
  groupActivities<T extends Activity, U extends AggregatedActivity>(activities: T[]): { [key: string]: U } {
    const aggregateJson = {}

    // # make sure that if we aggregated multiple activities
    // # they end up in serializationId desc in the aggregated activity 
    const sortedActivities = activities.sort((activityA, activityB) => {
      return (activityA.serializationId > activityB.serializationId) ? 1 : -1
    })

    for (const activity of sortedActivities) {
      const group = this.getGroup(activity)
      if (!(group in aggregateJson)) {
        aggregateJson[group] = new this.AggregatedActivityClass(group)
      }
      aggregateJson[group].append(activity)
    }
    return aggregateJson
  }

  
  /**
   * Returns a group string 
   * @param activity 
   */
  abstract getGroup(activity): string

  /**
   * The ranking logic, for sorting aggregated activities 
   * @param aggregatedActivities 
   */
  abstract rank(aggregatedActivities): AggregatedActivity[]
}

