 
import faker from "@faker-js/faker";
import { RegisterManager } from "../registerManager";
import { CassandraManager } from "./CassandraManager";

/**
 * Test class for manager
 */
@RegisterManager()
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
