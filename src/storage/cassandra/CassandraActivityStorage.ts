import { BaseActivityStorage } from "../base/base_activity_storage";

/**
 * Cassandra does not store seperate activity like in redis
 * all the activity is store within cassandra row
 * this is here to fulfill inheritance
 */
export class CassandraActivityStorage extends BaseActivityStorage {
  async getFromStorage(activityIds, kwargs) { /** no-op */ }
  async addToStorage(serializedActivities, kwargs) { /** no-op */ }
  async removeFromStorage(activityIds, kwargs) { /** no-op */ }
  async flush() { /** no-op */ }
}