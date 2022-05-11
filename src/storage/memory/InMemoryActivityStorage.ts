import createDebug from 'debug'
import { BaseActivityStorage } from "../base/base_activity_storage"

const debug = createDebug('superstream:inmemoryActivityStorage')

let activityStore = {} // defaultdict(dict)


export class InMemoryActivityStorage extends BaseActivityStorage {

  async getFromStorage(activityIds: string[], args) {
    // return { _id: activityStore.get(_id) for _id in activityIds }
    const result = {}
    activityIds.forEach(id => {
      result[id] = activityStore[id]
    })
    return result
  }

  async addToStorage(activities: { [activityId: string]: any }, args?) {
    debug('Adding to storage');
    let insert_count = 0
    const keyValuePairs = Object.entries(activities)

    for (const [activityId, activity_data] of keyValuePairs) {
      const found = activityStore[activityId]
      if (!found)
        insert_count += 1
      activityStore[activityId] = activity_data
    }
    // for (activityId, activity_data in six.iteritems(activities)) {
    //   if (activityId not in activityStore)
    //   insert_count += 1
    //   activityStore[activityId] = activity_data
    // }
    return insert_count
  }

  async removeFromStorage(activityIds, args) {
    var removed = 0
    for (const activityId of activityIds) {
      var exists = activityStore[activityId]
      debug('exists', exists);
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
