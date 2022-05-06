import { CassandraManager } from '../../src/feedManagers/cassandra/CassandraManager';

export class CustomCassandraManager extends CassandraManager {
  // temporary stud
  async getUserFollowerIds() {
    return {
      'HIGH': [],
      'LOW': []
    }
  }
}