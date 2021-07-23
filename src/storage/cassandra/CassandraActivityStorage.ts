import { NotImplementedError } from "../../errors"
import { BaseActivityStorage } from "../base"

/**
 * Cassandra does not store seperate activity like redis
 * all the activity is store within cassandra row
 * this is here to fulfill inheritance
 */
export class CassandraActivityStorage extends BaseActivityStorage {

  async getFromStorage(activityIds, kwargs): Promise<{}> {
    throw new NotImplementedError('Not implemented')
  }
  async addToStorage(serializedActivities, kwargs) {
    throw new NotImplementedError('Not implemented')
  }
  async removeFromStorage(activityIds, kwargs) {
    throw new NotImplementedError('Not implemented')
  }

  flush() {
    throw new Error('Not implement')
    return 'not_implemented'
  }
}