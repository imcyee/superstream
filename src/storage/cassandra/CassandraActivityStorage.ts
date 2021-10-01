import { BaseActivityStorage } from "../base"

/**
 * Cassandra does not store seperate activity like redis
 * all the activity is store within cassandra row
 * this is here to fulfill inheritance
 */
export class CassandraActivityStorage extends BaseActivityStorage {
  async getFromStorage(activityIds, kwargs) { /** no-op */ }
  async addToStorage(serializedActivities, kwargs) { /** no-op */ }
  async removeFromStorage(activityIds, kwargs) { /** no-op */ }
  async flush() { /** no-op */ }
}