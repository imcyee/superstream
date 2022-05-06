import { RedisManager } from '../../src/feedManagers/redis/RedisManager';

export class CustomRedisManager extends RedisManager {
  // temporary stud
  async getUserFollowerIds() {
    return {
      'HIGH': [],
      'LOW': []
    }
  }
}