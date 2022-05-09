// from stream_framework.storage.base import (BaseTimelineStorage, BaseActivityStorage)
// from collections import { BaseTimelineStorage } from "./base/base_timeline_storage"
// import defaultdict
// from contextlib import contextmanager
// import six

import { zip } from "lodash"
import { Activity } from ".."
import { ValueError } from "../errors"
import { BaseActivityStorage } from "./base/base_activity_storage"
import { BaseTimelineStorage } from "./base/base_timeline_storage"

const timelineStore = {} // defaultdict(list)
let activityStore = {} // defaultdict(dict)


/**
 * same as python bisect.bisect_left but for
 * lists with reversed order
 * Locate the insertion point for x in a to maintain sorted order. 
 * The parameters lo and hi may be used to specify 
 * a subset of the list which should be considered; 
 * by default the entire list is used. 
 * If x is already present in a, 
 * the insertion point will be before (to the left of) any existing entries. 
 * The return value is suitable for use as the first parameter 
 * to list.insert() assuming that a is already sorted.
 * @param a 
 * @param x 
 * @param lo 
 * @param hi 
 * @returns 
 */
function reverse_bisect_left(a, x, lo = 0, hi = null) {
  if (lo < 0) {
    throw new ValueError('lo must be non-negative')
  }

  if (!hi) {
    hi = a.length
  }

  while (lo < hi) {
    const mid = (lo + hi) // 2
    if (x > a[mid])
      hi = mid
    else
      lo = mid + 1
  }
  return lo
}

export class InMemoryActivityStorage extends BaseActivityStorage {

  async getFromStorage(activity_ids: string[], args) {
    // return { _id: activityStore.get(_id) for _id in activity_ids }
    const result = {}
    activity_ids.forEach(id => {
      result[id] = activityStore[id]
    })
    return result
  }

  async addToStorage(activities: { [activity_id: string]: any }, args?) {
    let insert_count = 0
    const keyValuePairs = Object.entries(activities)

    for (const [activity_id, activity_data] of keyValuePairs) {
      const found = activityStore[activity_id]
      if (!found)
        insert_count += 1
      activityStore[activity_id] = activity_data
    }
    // for (activity_id, activity_data in six.iteritems(activities)) {
    //   if (activity_id not in activityStore)
    //   insert_count += 1
    //   activityStore[activity_id] = activity_data
    // }
    return insert_count
  }

  async removeFromStorage(activity_ids, args) {
    var removed = 0
    for (const activityId of activity_ids) {
      var exists = activityStore[activityId]
      console.log('exists', exists);
      // var exists = activityStore.pop(activityId, None)
      if (exists) {
        removed += 1
        delete activityStore[activityId]
      }
    }
    return removed
  }

  async flush() {
    for (var a in activityStore)
      delete activityStore[a];
    // activityStore = {}
  }
}

export class InMemoryTimelineStorage extends BaseTimelineStorage {

  async contains(key, activity_id) {
    var timeline = timelineStore[key] || []
    const found = activity_id in timeline
    console.log(found);
    return activity_id in timeline
  }

  async getIndexOf(key, activity_id) {
    var timeline = timelineStore[key] || []
    return timeline.index(activity_id)
  }

  async getSliceFromStorage({
    key,
    start,
    stop,
    filter_kwargs = undefined,
    ordering_args = undefined
  }) {
    console.log('timelineStore', timelineStore);
    var timeline = timelineStore[key] || []
    var results = timeline.splice(start, stop)
    console.log('results', results); 
    var score_value_pairs = zip(results, results)
    return score_value_pairs
  }

  async addToStorage(
    key,
    activities: { [activityId: string]: any },
    args
  ) {
    var timeline = timelineStore[key]
    if (!timeline) {
      timelineStore[key] = []
      timeline = timelineStore[key]
    }
    var initial_count = timeline.length
    const keyValuePairs = Object.entries(activities)
    for (const [activity_id, activity_data] of keyValuePairs) {
      if (await this.contains(key, activity_id)) {
        console.log('continuing ', this.contains(key, activity_id));
        continue
      }
      console.log('activity_data', activity_data);
      timeline.splice(
        reverse_bisect_left(timeline, activity_id),
        0,
        activity_data
      )
    }
    return timeline.length - initial_count
  }

  async removeFromStorage(key, activities, args) {
    const timeline = timelineStore[key] || []
    const initial_count = timeline.length
    const keys = Object.keys(activities)
    for (const activity_id of keys) {
      if (this.contains(key, activity_id))
        timeline.remove(activity_id)
    }
    return initial_count - timeline.length
  }

  async getBatchInterface() {
    // @contextmanager
    //     def meandmyself():
    // yield cls
    // return meandmyself()
  }

  async count(key, args) {
    const timeline = timelineStore[key] || []
    return timeline.length
  }

  async delete(key, args) {
    const exist = timelineStore[key]
    if (exist)
      delete timelineStore[key]
    // timelineStore.pop(key, None)
  }

  async trim(key, length) {
    // const timeline = timelineStore[key] || []
    timelineStore[key] = timelineStore[key].splice(length)
  }

  async flush() {
    // juz to satisfy inheritance
    for (var a in timelineStore)
      delete timelineStore[a];
    // activityStore = {}
  }
}