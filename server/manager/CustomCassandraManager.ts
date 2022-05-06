import { CassandraManager } from '../../src/feedManagers/cassandra/CassandraManager';
import { RegisterManager } from '../../src/feedManagers/registerManager';
 
@RegisterManager()
export class CustomCassandraManager extends CassandraManager {
  // temporary stud
  async getUserFollowerIds() {
    return {
      'HIGH': [],
      'LOW': []
    }
  }
}