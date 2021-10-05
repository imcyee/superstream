import { RedisManager } from '../../src/feedManagers/RedisManager';

export class CustomRedisManager extends RedisManager {
  // temporary stud
  async getUserFollowerIds() {
    return {
      'HIGH': [],
      'LOW': []
    }
  }
}