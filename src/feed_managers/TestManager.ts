import { Manager } from "./base";
import faker from 'faker'

/**
 * Test class for manager
 */
export class TestManager extends Manager {
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