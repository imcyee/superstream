import { BaseSerializer } from "./BaseSerializer"
import { BaseAggregatedSerializer } from "./BaseAggregatedSerializer";

export class DummySerializer extends BaseSerializer {
  // The dummy serializer doesnt care about the type of your data
  checkType(data) { }
}

export class DummyAggregatedSerializer extends BaseAggregatedSerializer {
  //   The dummy serializer doesnt care about the type of your data
  checkType(data) { }
}