// from stream_framework.storage.base import (BaseTimelineStorage, BaseActivityStorage)
// from collections import { BaseTimelineStorage } from "./base/base_timeline_storage"
// import defaultdict
// from contextlib import contextmanager
// import six

import { ValueError } from "../errors"
import { BaseActivityStorage } from "./base/base_activity_storage"
import { BaseTimelineStorage } from "./base/base_timeline_storage"

const timelineStore = {} // defaultdict(list)
const activityStore = {} // defaultdict(dict)

// '''
// same as python bisect.bisect_left but for
// lists with reversed order
// '''
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

  async addToStorage(activities, args) {
    let insert_count = 0
    for (activity_id, activity_data in six.iteritems(activities)) {
      if (activity_id not in activityStore)
      insert_count += 1
      activityStore[activity_id] = activity_data
    }
    return insert_count
  }

  async removeFromStorage(activity_ids, args) {
    var removed = 0
    for (const activityId of activity_ids) {
      var exists = activityStore.pop(activityId, None)
      if (exists)
        removed += 1
    }
    return removed
  }

  async flush() {
    activityStore.clear()
  }
}

export class InMemoryTimelineStorage extends BaseTimelineStorage {

  async contains(key, activity_id) {
    return activity_id in timelineStore[key]
  }

  async getIndexOf(key, activity_id) {
    return timelineStore[key].index(activity_id)
  }

  async getSliceFromStorage({
    key,
    start,
    stop,
    filter_kwargs = undefined,
    ordering_args = undefined
  }) {
    var results = list(timelineStore[key][start: stop])
    var score_value_pairs = list(zip(results, results))
    return score_value_pairs
  }

  async addToStorage(key, activities, args) {
    var timeline = timelineStore[key]
    var initial_count = timeline.length
    for (activity_id, activity_data in six.iteritems(activities)) {
      if (this.contains(key, activity_id))
        continue
      timeline.insert(reverse_bisect_left(timeline, activity_id), activity_data)
    }
    return timeline.length - initial_count
  }

  async remove_from_storage(key, activities, args) {
    const timeline = timelineStore[key]
    const initial_count = timeline.length
    for (activity_id in activities.keys()) {
      if (self.contains(key, activity_id))
        timeline.remove(activity_id)
    }
    return initial_count - timeline.length
  }

  static get_batch_interface(cls) {
    @contextmanager
        def meandmyself():
    yield cls
    return meandmyself()
  }

  async count(key, args) {
    return timelineStore[key].length
  }

  async delete(key, args) {
    timelineStore.pop(key, None)
  }

  async trim(key, length) {
    timelineStore[key] = timelineStore[key][:length]
  }

}