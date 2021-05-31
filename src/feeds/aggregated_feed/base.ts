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

import { uniq } from "lodash"
import zip from "lodash/zip"
import { Activity, AggregatedActivity } from "../../activity"
import { ValueError } from "../../errors"
import { AggregatedActivitySerializer } from "../../serializers/aggregated_activity_serializer"
import { BaseFeed } from "../base"


// logger = logging.getLogger(__name__)


class AggregatedFeed extends BaseFeed {

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
  //// # : The class to use for aggregating activities into aggregated activities
  //// # : also see :class:`.BaseAggregator`
  aggregator_class = RecentVerbAggregator
  aggregated_activity_class
  //// # : The class to use for storing the aggregated activity
  static aggregated_activity_class = AggregatedActivity
  //// # : the number of aggregated items to search to see if we match
  //// # : or create a new_ aggregated activity
  merge_max_length = 20

  //// # : we use a different timeline serializer for aggregated activities
  timeline_serializer = AggregatedActivitySerializer

  // @classmethod
  static get_timeline_storage_options() {
    // '''
    // Returns the options for the timeline storage
    // '''
    const options = super.get_timeline_storage_options()
    options['aggregated_activity_class'] = this.aggregated_activity_class
    return options
  }

  async add_many(activities, { trim = true, current_activities = null, ...kwargs }) {
    // '''
    // Adds many activities to the feed

    // Unfortunately we can't support the batch interface.
    // The writes depend on the reads.

    // Also subsequent writes will depend on these writes.
    // So no batching is possible at all.

    // :param activities: the list of activities
    // '''
    // validate_list_of_strict(activities, [ this.activity_class, FakeActivity])

    // validate_list_of_strict(activities, [this.activity_class, FakeActivity])

    // # start by getting the aggregator
    const aggregator = this.get_aggregator()

    // const  t = timer()
    // # get the current aggregated activities
    if (!current_activities)
      current_activities = this.get_item(null, this.merge_max_length)
    const msg_format = 'reading %s items took %s'
    // logger.debug(msg_format, this.merge_max_length, t.next())

    // # merge the current activities with the new_ ones
    const [new_, changed, deleted] = aggregator.merge(
      current_activities, activities)
    // logger.debug('merge took %s', t.next())

    // # new_ ones we insert, changed we do a delete and insert
    var new_aggregated = this._update_from_diff(new_, changed, deleted)
    new_aggregated = aggregator.rank(new_aggregated)

    // # trim every now and then
    if (trim && Math.random() <= this.trim_chance)
      this.timeline_storage.trim(this.key, this.max_length)

    return new_aggregated
  }
  async remove_many(activities, { batch_interface = null, trim = true, ...kwargs }) {
    // '''
    // Removes many activities from the feed

    // :param activities: the list of activities to remove
    // '''
    // # trim to make sure nothing we don't need is stored after the max
    // # length
    this.trim()

    // # allow to delete activities from a specific list of activities
    // # instead of scanning max_length (eg. if the user implements a reverse index
    // # based on group)
    var current_activities = kwargs['current_activities']
    if (!current_activities)
      current_activities = await this.get_activity_slice(null, this.max_length, false)

    // # setup our variables
    const new_ = []
    const deleted = []
    const changed = []
    const getid = (a) => (a['serialization_id'] || a)

    // array of serialization_id
    const activities_to_remove = uniq(activities.map(a => getid(a))) as any[] // set(getid(a) for a in activities)


    // const activity_dict = dict((getid(a), a) for a in activities)
    const activity_dict = {}
    activities.forEach(a => {
      activity_dict[getid(a)] = a
    });
    // dict((getid(a), a) for a in activities)

    // # first built the activity lookup dict
    const activity_remove_dict = {}// defaultdict(list)
    for (const aggregated of current_activities) {
      for (const activity_id of aggregated.activity_ids) {
        if (activities_to_remove.includes(activity_id)) {
          // activity_remove_dict[aggregated].append(activity_id)
          activity_remove_dict[aggregated] = activity_id


          const index = activities_to_remove.indexOf(activity_id);
          if (index > -1) {
            activities_to_remove.splice(index, 1);
          }

          // activities_to_remove.discard(activity_id)
        }
      }
      // # stop searching when we have all of the activities to remove
      if (!activities_to_remove)
        break
    }
    // # stick the activities to remove in changed or remove
    var hydrated_aggregated = Object.keys(activity_remove_dict) // .keys()

    if (this.needs_hydration(hydrated_aggregated)) {
      hydrated_aggregated = await this.hydrate_activities(hydrated_aggregated)
    }

    const hydrate_dict = {}
    hydrated_aggregated.forEach(a => {
      hydrate_dict[activities.group] = a
    });

    // dict((a.group, a) for a in hydrated_aggregated)
    // for (aggregated, activity_ids_to_remove of activity_remove_dict.items()) {
    for (const key of Object.keys(activity_remove_dict)) {
      var aggregated = key
      const activity_ids_to_remove = activity_remove_dict[key]

      aggregated = hydrate_dict[aggregated.group]
      if (aggregated.length == activity_ids_to_remove.length) {
        deleted.push(aggregated)
      } else {
        const original = copy.deepcopy(aggregated)
        const activities_to_remove = map(activity_dict.get, activity_ids_to_remove)
        aggregated.remove_many(activities_to_remove)
        changed.push([original, aggregated])
      }
      // # new_ ones we insert, changed we do a delete and insert
      const new_aggregated = this._update_from_diff(new_, changed, deleted)
      return new_aggregated
    }
  }
  add_many_aggregated(aggregated, kwargs?) {
    // '''
    // Adds the list of aggregated activities

    // :param aggregated: the list of aggregated activities to add
    // '''
    // validate_list_of_strict(aggregated, [this.aggregated_activity_class, FakeAggregatedActivity])
    this.timeline_storage.add_many(this.key, aggregated, kwargs)
  }
  remove_many_aggregated(aggregated, kwargs?) {
    // '''
    // Removes the list of aggregated activities

    // :param aggregated: the list of aggregated activities to remove
    // '''
    // validate_list_of_strict(aggregated, [this.aggregated_activity_class, FakeAggregatedActivity])
    this.timeline_storage.remove_many(this.key, aggregated, kwargs)
  }
  async contains(activity) {
    // '''
    // Checks if the activity is present in any of the aggregated activities

    // :param activity: the activity to search for
    // '''
    // # get all the current aggregated activities
    const aggregated = await this.get_item(null, this.max_length)
    var activities = [] // sum([list(a.activities) for a in aggregated], [])
    aggregated.forEach(a => {
      activities.push(a.activities)
    });
    // # make sure we don't modify things in place
    // activities = copy.deepcopy(activities)
    // activity = copy.deepcopy(activity)

    const activity_dict = {}
    for (const a in activities) {
      const key = (a.verb.id, a.actor_id, a.object_id, a.target_id)
      activity_dict[key] = a
    }
    const a = activity
    const activity_key = (a.verb.id, a.actor_id, a.object_id, a.target_id)
    const present = activity_key in activity_dict
    return present
  }

  get_aggregator() {
    // '''
    // Returns the class used for aggregation
    // '''
    const aggregator = new this.aggregator_class(
      this.aggregated_activity_class,
      AggregatedFeed.activity_class // this.activity_class
    )
    return aggregator
  }

  _update_from_diff(new_, changed, deleted) {
    // '''
    // Sends the add and remove commands to the storage layer based on a diff
    // of

    // :param new_: list of new_ items
    // :param changed: list of tuples (from, to)
    // :param deleted: list of things to delete
    // '''
    const msg_format = 'now updating from diff new_: %s changed: %s deleted: %s'
    // logger.debug(msg_format, *map(len, [new_, changed, deleted]))
    const [to_remove, to_add] = this._translate_diff(new_, changed, deleted)

    //        // # remove those which changed
    //         with this.get_timeline_batch_interface() as batch_interface:{
    //             if (to_remove)
    //                 this.remove_many_aggregated( to_remove, batch_interface=batch_interface)
    // }
    //        // # now add the new_ ones
    //         with this.get_timeline_batch_interface() as batch_interface:{
    //             if (to_add)
    //                 this.add_many_aggregated( to_add, batch_interface=batch_interface)
    // }

    // # remove those which changed

    if (to_remove)
      this.remove_many_aggregated(to_remove)

    // # now add the new_ ones 
    if (to_add)
      this.add_many_aggregated(to_add)

    // logger.debug( 'removed %s, added %s items from feed %s', len(to_remove), len(to_add), this)

    // # return the merge of these two
    var new_aggregated = new_
    if (changed)
      new_aggregated += zip(...changed)[1]

    this.on_update_feed({
      new_: to_add,
      deleted: to_remove
    })
    return new_aggregated
  }
  _translate_diff(new_, changed, deleted) {
    // '''
    // Translates a list of new_ changed and deleted into
    // Add and remove instructions

    // :param new_: list of new_ items
    // :param changed: list of tuples (from, to)
    // :param deleted: list of things to delete
    // :returns: a tuple with a list of items to remove and to add

    // **Example**::

    //     new_ = [AggregatedActivity]
    //     deleted = [AggregatedActivity]
    //     changed = [(AggregatedActivity, AggregatedActivity)]
    //     to_remove, to_delete = feed._translate_diff(new_, changed, deleted)
    // '''
    // # validate this data makes sense
    var flat_changed = []
    changed.forEach(element => {
      flat_changed = [...flat_changed, ...element]
    });  // sum(map(list, changed), [])
    // for (const aggregated_activity of itertools.chain(new_, flat_changed, deleted)) {
    for (const aggregated_activity of [...new_, ...flat_changed, ...deleted]) {
      if (!(aggregated_activity instanceof AggregatedActivity)) {
        throw new ValueError(`please only send aggregated activities not ${aggregated_activity}`)
      }
    }
    // # now translate the instructions
    var to_remove = [...deleted] // deleted[:]
    var to_add = [...new_]
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
