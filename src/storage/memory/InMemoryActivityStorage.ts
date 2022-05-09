import { ValueError } from "../../errors"
import { BaseActivityStorage } from "../base/base_activity_storage"

let activityStore = {} // defaultdict(dict)

export class InMemoryActivityStorage extends BaseActivityStorage {

  async getFromStorage(activity_ids: string[], args) {
    // return { _id: activityStore.get(_id) for _id in activity_ids }
    const result = {}
    console.log(activityStore);
    activity_ids.forEach(id => {
      result[id] = activityStore[id]
    })
    console.log('result', result);
    return result
  }

  async addToStorage(activities: { [activity_id: string]: any }, args?) {

    console.log('adding to storage');
    let insert_count = 0
    const keyValuePairs = Object.entries(activities)

    console.log(keyValuePairs);
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
