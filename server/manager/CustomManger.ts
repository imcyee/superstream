import { Manager } from "../../src";

export class CustomManager extends Manager {
  // temporary stud
  async getUserFollowerIds() {
    return {
      'HIGH': [],
      'LOW': []
    }
  }
}