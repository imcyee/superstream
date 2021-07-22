import { Activity, AggregatedActivity } from "../activity"
import { DuplicateActivityException, ValueError } from "../errors"

/**
 * Base aggregator class
 */
class BaseAggregator {


  // Aggregators implement the combining of multiple activities into aggregated activities.
  // The two most important methods are
  // aggregate and merge
  // Aggregate takes a list of activities and turns it into a list of aggregated activities
  // Merge takes two lists of aggregated activities and returns a list of new and changed aggregated activities

  aggregated_activity_class = AggregatedActivity
  activity_class = Activity


  // :param aggregated_activity_class: the class which we should use
  // for returning the aggregated activities

  constructor(
    aggregated_activity_class = null,
    activity_class = null
  ) {
    if (!aggregated_activity_class)
      this.aggregated_activity_class = aggregated_activity_class
    if (!activity_class)
      this.activity_class = activity_class
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
   *     aggregated_activities = aggregator.aggregate(activities)
   */
  aggregate(activities) {
    const aggregate_dict = this.group_activities(activities)
    const aggregated_activities = Object.values(aggregate_dict)
    const ranked_aggregates = this.rank(aggregated_activities)
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
  //     aggregated_activities = aggregator.aggregate(activities)
  //     activities = [Activity(3), Activity(4)]
  //     new, changed = aggregator.merge(aggregated_activities, activities)
  //     for activity in new:
  //         print activity
  //     for from, to in changed:
  //         print 'changed from %s to %s' % (from, to)

  //  dict([('sape', 4139), ('guido', 4127), ('jack', 4098)])  
  // const current_activities_dict = dict([(a.group, a) for a in aggregated])
  merge(aggregated, activities) {
    var current_activities_dict
    for (const a of aggregated) {
      current_activities_dict[a.group] = a
    }

    const new_ = []
    const changed = []
    const new_aggregated = this.aggregate(activities)

    for (const aggregated of new_aggregated) {
      if (!(aggregated.group in current_activities_dict)) {
        new_.push(aggregated)
      } else {
        const current_aggregated = current_activities_dict.get(aggregated.group)
        const new_aggregated = JSON.parse(JSON.stringify(current_aggregated)) //deepcopy(current_aggregated)
        for (const activity of aggregated.activities) {
          try {
            new_aggregated.push(activity)
          } catch (e) {
            throw new DuplicateActivityException()
          }
        }
        if (current_aggregated.activities != new_aggregated.activities) {
          changed.push([current_aggregated, new_aggregated])
        }
      }
    }

    return {
      new_,
      changed,
      empty: []
    }
  }

  // Groups the activities based on their group
  // Found by running get_group(actvity on them) 
  group_activities(activities) {

    const aggregate_dict = {} // dict()
    // # make sure that if we aggregated multiple activities
    // # they end up in serialization_id desc in the aggregated activity
    // activities = list(activities)
    // activities = list(activities)
    activities.sort()
    for (const activity of activities) {
      const group = this.get_group(activity)
      if (!(group in aggregate_dict)) {
        aggregate_dict[group] = new this.aggregated_activity_class(group)
      }
      aggregate_dict[group].push(activity)
    }
    return aggregate_dict
  }

  // Returns a group to stick this activity in 
  get_group(activity): string {

    throw new ValueError('not implemented')
  }

  // The ranking logic, for sorting aggregated activities 
  rank(aggregated_activities): AggregatedActivity[] {
    throw new ValueError('not implemented')
  }
}

// Most recently updated aggregated activities are ranked first.
class RecentRankMixin {

  rank(aggregated_activities): AggregatedActivity[] {
    // The ranking logic, for sorting aggregated activities
    // aggregated_activities.sort(key = lambda a: a.updated_at, reverse = True)
    aggregated_activities.sort((a, b) => {
      return a.updated_at > b.updated_at
    })
    return aggregated_activities
  }
}

// Aggregates based on the same verb and same time period 
class RecentVerbAggregator {
  get_group(activity) {
    const verb = activity.verb.id
    const date = activity.time.date()
    // Returns a group based on the day and verb 
    const group = `${verb}-${date}` // '%s-%s' % (verb, date)
    return group
  }
}

// Aggregates based on the same verb, object and day 
class NotificationAggregator {
  get_group(activity) {
    const verb = activity.verb.id
    const object_id = activity.object_id
    const date = activity.time.date()
    // Returns a group based on the verb, object and day 
    const group = `${verb}-${object_id}-${date}` // '%s-%s-%s' % (verb, object_id, date)
    return group
  }
}
interface RecentVerbAggregator extends RecentRankMixin, BaseAggregator { }
interface NotificationAggregator extends RecentRankMixin, BaseAggregator { }
// Apply the mixins into the base class via
// the JS at runtime
applyMixins(RecentVerbAggregator, [RecentRankMixin, BaseAggregator]);
applyMixins(NotificationAggregator, [RecentRankMixin, BaseAggregator])

// This can live anywhere in your codebase:
function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
        Object.create(null)
      );
    });
  });
}