// from stream_framework.activity import AggregatedActivity
// from stream_framework.aggregators.base import RecentVerbAggregator
// from stream_framework.feeds.base import BaseFeed
// from stream_framework.serializers.aggregated_activity_serializer import \
//     AggregatedActivitySerializer
// import copy
// import logging
// import random
// import itertools
// from stream_framework.utils.timing import timer
// from collections import defaultdict
// from stream_framework.utils.validate import validate_list_of_strict
// from stream_framework.tests.utils import FakeActivity, FakeAggregatedActivity

import { cloneDeep, uniq } from "lodash"
import zip from "lodash/zip"
import { Activity } from "../../activity/Activity"
import { AggregatedActivity } from "../../activity/AggregatedActivity" 
import { RecentVerbAggregator } from "../../aggregators/recentVerb.aggregator"
import { ValueError } from "../../errors"
import { AggregatedActivitySerializer } from "../../serializers/AggregatedActivitySerializer"
import { BaseFeed } from "../base/base"


// logger = logging.getLogger(__name__)


// '''
// Aggregated feeds are an extension of the basic feed.
// They turn activities into aggregated activities by using an aggregator class.

// See :class:`.BaseAggregator`

// You can use aggregated feeds to built smart feeds, such as Facebook's newsfeed.
// Alternatively you can also use smart feeds for building complex notification systems.

// Have a look at fashiolista.com for the possibilities.

// .. note::
//    Aggregated feeds do more work in the fanout phase. Remember that for every user
//    activity the number of fanouts is equal to their number of followers.
//    So with a 1000 user activities, with an average of 500 followers per user, you
//    already end up running 500.000 fanout operations

//    Since the fanout operation happens so often, you should make sure not to
//    do any queries in the fanout phase or any other resource intensive operations.

// Aggregated feeds differ from feeds in a few ways:

// - Aggregator classes aggregate activities into aggregated activities
// - We need to update aggregated activities instead of only appending
// - Serialization is different
// '''
export class AggregatedFeed extends BaseFeed {

  //// # : The class to use for storing the aggregated activity
  static AggregatedActivityClass = AggregatedActivity

  //// # : The class to use for aggregating activities into aggregated activities
  //// # : also see :class:`.BaseAggregator`
  AggregatorClass = RecentVerbAggregator

  // AggregatedActivityClass

  //// # : the number of aggregated items to search to see if we match
  //// # : or create a new aggregated activity
  mergeMaxLength = 20

  //// # : we use a different timeline serializer for aggregated activities
  static TimelineSerializer = AggregatedActivitySerializer
  // TimelineSerializer = AggregatedActivitySerializer

  // '''
  // Returns the options for the timeline storage
  // '''
  static getTimelineStorageOptions() {
    const options = super.getTimelineStorageOptions()
    options['AggregatedActivityClass'] = this.AggregatedActivityClass
    return options
  }

  // '''
  // Adds many activities to the feed

  // Unfortunately we can't support the batch interface.
  // The writes depend on the reads.

  // Also subsequent writes will depend on these writes.
  // So no batching is possible at all.

  // :param activities: the list of activities
  // '''
  async addMany(activities, options) {
    var { trim = true, currentActivities = null, ...kwargs } = options || {}
    // validate_list_of_strict(activities, [ this.ActivityClass, FakeActivity])

    // validate_list_of_strict(activities, [this.ActivityClass, FakeActivity])

    // # start by getting the aggregator
    const aggregator = this.getAggregator()

    // const  t = timer()
    // # get the current aggregated activities
    if (!currentActivities)
      //   current_activities = self[:self.merge_max_length]
      currentActivities = await this.getItem(0, this.mergeMaxLength)
    const msg_format = 'reading %s items took %s'
    // logger.debug(msg_format, this.mergeMaxLength, t.next())


    // # merge the current activities with the new ones
    const { latest, changed, deleted } = aggregator.merge(currentActivities, activities)
    // logger.debug('merge took %s', t.next())


    // # new ones we insert, changed we do a delete and insert
    var newAggregated = await this._updateFromDiff(latest, changed, deleted)

    newAggregated = aggregator.rank(newAggregated)

    // # trim every now and then
    if (trim && Math.random() <= this.trimChance)
      this.timelineStorage.trim(this.key, this.maxLength)

    return newAggregated
  }


  // '''
  // Removes many activities from the feed
  // :param activities: the list of activities to remove
  // '''
  async removeMany(activities, { batchInterface = null, trim = true, ...kwargs }) {
    // # trim to make sure nothing we don't need is stored after the max
    // # length
    this.trim()

    // # allow to delete activities from a specific list of activities
    // # instead of scanning maxLength (eg. if the user implements a reverse index
    // # based on group)
    var currentActivities: AggregatedActivity[] = kwargs['currentActivities']
    if (!currentActivities)
      currentActivities = await this.getActivitySlice(null, this.maxLength, false)

    // # setup our variables
    const latest = []
    const deleted = []
    const changed = []
    const getId = (a) => (a['serializationId'] || a)

    // array of serializationId
    let activitiesToRemove = uniq(activities.map(a => getId(a))) // set(getId(a) for a in activities)


    // const activityDict = dict((getId(a), a) for a in activities)
    const activityDict = {}
    activities.forEach(a => {
      activityDict[getId(a)] = a
    });
    // dict((getId(a), a) for a in activities)

    // # first built the activity lookup dict
    const activityRemoveDict: {
      [serializationId: string]: {
        activityIdsToRemove: string[],
        aggregated: AggregatedActivity
      }
    } = {} // defaultdict(list)
    for (const aggregated of currentActivities) {
      const aggregatedSerializationId = aggregated.serializationId
      activityRemoveDict[aggregatedSerializationId] = {
        activityIdsToRemove: [],
        aggregated
      }
      for (const activityId of aggregated.activityIds) {
        if (activitiesToRemove.includes(activityId)) {
          // activityRemoveDict[aggregated].append(activityId)
          // python allow tuple as key which is problematic in js
          // activityRemoveDict[aggregated] = activityId

          activityRemoveDict[aggregatedSerializationId]
            .activityIdsToRemove
            .push(activityId)

          // remove the index that has already removed
          const index = activitiesToRemove.indexOf(activityId);
          if (index > -1) {
            activitiesToRemove.splice(index, 1);
          }

          // activitiesToRemove.discard(activityId)
        }
      }
      // # stop searching when we have all of the activities to remove
      if (!activitiesToRemove)
        break
    }
    // # stick the activities to remove in changed or remove
    // var hydratedAggregated = Object.keys(activityRemoveDict) // .keys()
    var hydratedAggregated = Object.values(activityRemoveDict).map((a: any) => {
      return a.aggregated
    }) // .keys()

    if (this.needsHydration(hydratedAggregated)) {
      hydratedAggregated = await this.hydrateActivities(hydratedAggregated)
    }

    const hydrateDict = {}
    hydratedAggregated.forEach(a => {
      hydrateDict[activities.group] = a
    });

    // dict((a.group, a) for a in hydratedAggregated)
    // for (aggregated, activityIdsToRemove of activityRemoveDict.items()) {
    // for (const key of Object.keys(activityRemoveDict)) {
    for (var { aggregated, activityIdsToRemove } of Object.values(activityRemoveDict)) {
      // var { aggregated } = activityRemove
      // const { activityIdsToRemove } = activityRemove

      // var aggregated = activityRemoveDict[activityId]

      // const activityIdsToRemove = activityId

      aggregated = hydrateDict[aggregated.group]
      if (aggregated.length == activityIdsToRemove.length) {
        deleted.push(aggregated)
      } else {
        // const original = copy.deepcopy(aggregated)
        const original = cloneDeep(aggregated)
        // const activitiesToRemove = map(activityDict.get, activityIdsToRemove)

        activitiesToRemove = []
        // const activitiesToRemove = 
        Object.keys(activityDict).map((k) => {
          if (activityIdsToRemove.includes(k)) {
            activitiesToRemove.push(activityDict[k])
          }
          // return activityIdsToRemove
          // activityDict.get, activityIdsToRemove
        })
        aggregated.removeMany(activitiesToRemove)
        changed.push([original, aggregated])
      }
      // # latest ones we insert, changed we do a delete and insert
      const newAggregated = await this._updateFromDiff(latest, changed, deleted)
      return newAggregated
    }
  }


  // // '''
  // // Removes many activities from the feed
  // // :param activities: the list of activities to remove
  // // '''
  // async removeMany(activities, { batchInterface = null, trim = true, ...kwargs }) {
  //   // # trim to make sure nothing we don't need is stored after the max
  //   // # length
  //   this.trim()

  //   // # allow to delete activities from a specific list of activities
  //   // # instead of scanning maxLength (eg. if the user implements a reverse index
  //   // # based on group)
  //   var currentActivities = kwargs['currentActivities']
  //   if (!currentActivities)
  //     currentActivities = await this.getActivitySlice(null, this.maxLength, false)

  //   // # setup our variables
  //   const latest = []
  //   const deleted = []
  //   const changed = []
  //   const getId = (a) => (a['serializationId'] || a)

  //   // array of serializationId
  //   const activitiesToRemove = uniq(activities.map(a => getId(a))) // set(getId(a) for a in activities)


  //   // const activityDict = dict((getId(a), a) for a in activities)
  //   const activityDict = {}
  //   activities.forEach(a => {
  //     activityDict[getId(a)] = a
  //   });
  //   // dict((getId(a), a) for a in activities)

  //   // # first built the activity lookup dict
  //   const activityRemoveDict = {}// defaultdict(list)
  //   for (const aggregated of currentActivities) {
  //     for (const activityId of aggregated.activityIds) {
  //       if (activitiesToRemove.includes(activityId)) {
  //         // activityRemoveDict[aggregated].append(activityId)
  //         // python allow tuple as key which is problematic in js
  //         activityRemoveDict[aggregated] = activityId


  //         const index = activitiesToRemove.indexOf(activityId);
  //         if (index > -1) {
  //           activitiesToRemove.splice(index, 1);
  //         }

  //         // activitiesToRemove.discard(activityId)
  //       }
  //     }
  //     // # stop searching when we have all of the activities to remove
  //     if (!activitiesToRemove)
  //       break
  //   }
  //   // # stick the activities to remove in changed or remove
  //   var hydratedAggregated = Object.keys(activityRemoveDict) // .keys()

  //   if (this.needsHydration(hydratedAggregated)) {
  //     hydratedAggregated = await this.hydrateActivities(hydratedAggregated)
  //   }

  //   const hydrateDict = {}
  //   hydratedAggregated.forEach(a => {
  //     hydrateDict[activities.group] = a
  //   });

  //   // dict((a.group, a) for a in hydratedAggregated)
  //   // for (aggregated, activityIdsToRemove of activityRemoveDict.items()) {
  //   for (const key of Object.keys(activityRemoveDict)) {
  //     var aggregated = key
  //     const activityIdsToRemove = activityRemoveDict[key]

  //     aggregated = hydrateDict[aggregated.group]
  //     if (aggregated.length == activityIdsToRemove.length) {
  //       deleted.push(aggregated)
  //     } else {
  //       const original = copy.deepcopy(aggregated)
  //       const activitiesToRemove = map(activityDict.get, activityIdsToRemove)
  //       aggregated.removeMany(activitiesToRemove)
  //       changed.push([original, aggregated])
  //     }
  //     // # latest ones we insert, changed we do a delete and insert
  //     const newAggregated = await this._updateFromDiff(latest, changed, deleted)
  //     return newAggregated
  //   }
  // }

  // '''
  // Adds the list of aggregated activities

  // :param aggregated: the list of aggregated activities to add
  // '''
  async addManyAggregated(aggregated, kwargs?) {
    // validate_list_of_strict(aggregated, [this.AggregatedActivityClass, FakeAggregatedActivity])

    await this.timelineStorage.addMany(this.key, aggregated, kwargs)
  }

  // '''
  // Removes the list of aggregated activities
  // :param aggregated: the list of aggregated activities to remove
  // '''
  async removeManyAggregated(aggregated, kwargs?) {
    // validate_list_of_strict(aggregated, [this.AggregatedActivityClass, FakeAggregatedActivity])
    await this.timelineStorage.removeMany(this.key, aggregated, kwargs)
  }

  // '''
  // Checks if the activity is present in any of the aggregated activities
  // :param activity: the activity to search for
  // '''
  async contains(activity) {
    // # get all the current aggregated activities
    const aggregated = await this.getItem(null, this.maxLength)
    var activities: Activity[] = []   // sum([list(a.activities) for a in aggregated], [])
    aggregated.forEach(a => {
      activities.push(a.activities)
    });
    // # make sure we don't modify things in place
    activities = cloneDeep(activities)
    activity = cloneDeep(activity)

    const activityDict = {}
    for (const a of activities) {
      // const key =  (a.verb.id, a.actorId, a.objectId, a.targetId)
      const key = `${a.verbId}, ${a.actorId}, ${a.objectId}, ${a.targetId}`
      activityDict[key] = a
    }
    const a = activity
    const activity_key = `${a.verbId}, ${a.actorId}, ${a.objectId}, ${a.targetId}`
    // const present = activity_key in activityDict
    const present = Object.keys(activityDict).includes(activity_key) // activity_key in activityDict
    return present
  }

  // '''
  // Returns the class used for aggregation
  // '''
  getAggregator() {
    const aggregator = new this.AggregatorClass(
      AggregatedFeed.AggregatedActivityClass,
      AggregatedFeed.ActivityClass // this.ActivityClass
    )
    return aggregator
  }

  // '''
  // Sends the add and remove commands to the storage layer based on a diff
  // of
  // :param latest: list of latest items
  // :param changed: list of tuples (from, to)
  // :param deleted: list of things to delete
  // '''
  async _updateFromDiff(latest, changed, deleted) {
    const msg_format = 'now updating from diff latest: %s changed: %s deleted: %s'
    // logger.debug(msg_format, *map(len, [latest, changed, deleted]))
    const [to_remove, to_add] = this._translateDiff(latest, changed, deleted)

    //        // # remove those which changed
    //         with this.getTimelineBatchInterface() as batchInterface:{
    //             if (to_remove)
    //                 this.removeManyAggregated( to_remove, batchInterface=batchInterface)
    // }
    //        // # now add the latest ones
    //         with this.getTimelineBatchInterface() as batchInterface:{
    //             if (to_add)
    //                 this.addManyAggregated( to_add, batchInterface=batchInterface)
    // }

    // # remove those which changed

    if (to_remove)
      await this.removeManyAggregated(to_remove)

    // # now add the latest ones 
    if (to_add)
      await this.addManyAggregated(to_add)

    // logger.debug( 'removed %s, added %s items from feed %s', len(to_remove), len(to_add), this)

    // # return the merge of these two
    var newAggregated = latest



    // if (changed)
    //   newAggregated += zip(...changed)[1]
    if (changed)
      newAggregated.push(zip(...changed)[1])

    this.onUpdateFeed({
      newInserted: to_add,
      deleted: to_remove
    })
    return newAggregated
  }

  // '''
  // Translates a list of latest changed and deleted into
  // Add and remove instructions

  // :param latest: list of latest items
  // :param changed: list of tuples (from, to)
  // :param deleted: list of things to delete
  // :returns: a tuple with a list of items to remove and to add

  // **Example**::

  //     latest = [AggregatedActivity]
  //     deleted = [AggregatedActivity]
  //     changed = [(AggregatedActivity, AggregatedActivity)]
  //     to_remove, to_delete = feed._translateDiff(latest, changed, deleted)
  // '''
  _translateDiff(latest, changed, deleted) {
    // # validate this data makes sense
    var flat_changed = []
    changed.forEach(element => {
      flat_changed = [...flat_changed, ...element]
    });  // sum(map(list, changed), [])
    // for (const aggregated_activity of itertools.chain(latest, flat_changed, deleted)) {
    for (const aggregated_activity of [...latest, ...flat_changed, ...deleted]) {
      if (!(aggregated_activity instanceof AggregatedActivity)) {
        throw new ValueError(`please only send aggregated activities not ${aggregated_activity}`)
      }
    }
    // # now translate the instructions
    var to_remove = [...deleted] // deleted[:]
    var to_add = [...latest]
    if (changed) {
      changed.forEach(element => {
        to_remove.push(element[0])
        to_add.push(element[1])
      });
      // to_remove += [c[0] for c in changed]
      // to_add += [c[1] for c in changed]
    }
    return [to_remove, to_add]
  }
}



// function validate_list_of_strict(object_list, object_types) {
//   // '''
//   // Verifies that the items in object_list are of
//   // type object__type

//   // :param object_list: the list of objects to check
//   // :param object_types: the type of the object (or tuple with types)

//   // In general this goes against Python's duck typing ideology
//   // See this discussion for instance
//   // http://stackoverflow.com/questions/1549801/differences-between-isinstance-and-type-in-python

//   // We use it in cases where you can configure the type of class to use
//   // And where we should validate that you are infact supplying that class
//   // '''
//   for (const object_ of object_list)
//     validate_type_strict(object_, object_types)
// }

// function validate_type_strict(object_, object_types) {
//   // '''
//   // Validates that object_ is of type object__type
//   // :param object_: the object to check
//   // :param object_types: the desired type of the object (or tuple of types)
//   // '''
//   var object_types
//   if (!(object_types instanceof tuple)) {
//     object_types = (object_types,)
//   }
//   const exact_type_match = any([type(object_) == t for t in object_types])
//   if (!exact_type_match) {
//     throw new ValueError(`Please pass object_ of type ${object_types} as the argument, encountered type ${typeof (object_)}`)
//   }
// }

// class FakeActivity extends Activity { }

// class FakeAggregatedActivity extends AggregatedActivity { }
