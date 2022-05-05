import faker from "faker";
import { CassandraManager } from "./CassandraManager";

/**
 * Test class for manager
 */
export class CassandraTestManager extends CassandraManager {

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
