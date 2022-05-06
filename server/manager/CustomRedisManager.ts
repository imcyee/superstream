import { RedisManager } from '../../src/feedManagers/redis/RedisManager';
import { RegisterManager } from '../../src/feedManagers/registerManager';

@RegisterManager()
export class CustomRedisManager extends RedisManager {
  // temporary stud
  async getUserFollowerIds() {
    return {
      'HIGH': [],
      'LOW': []
    }
  }
}