import faker from "faker";
import { RedisManager } from "./RedisManager";

/**
 * Test class for manager
 */
 export class RedisTestManager extends RedisManager {
  async getUserFollowerIds() {
    return {
      HIGH: [
        faker.datatype.uuid(),
        faker.datatype.uuid(),
        faker.datatype.uuid(),
        faker.datatype.uuid(),
      ]
    }
  }
}