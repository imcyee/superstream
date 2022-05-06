import faker from "faker";
import { RegisterManager } from "../registerManager";
import { RedisManager } from "./RedisManager";

/**
 * Test class for manager
 */
 @RegisterManager()
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