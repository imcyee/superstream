import { BaseSerializer, BaseAggregatedSerializer } from "./base"



export class DummySerializer extends BaseSerializer {

  // '''
  // The dummy serializer doesnt care about the type of your data
  // '''
  check_type(data) { }
}

export class DummyAggregatedSerializer extends BaseAggregatedSerializer {

  // '''
  //   The dummy serializer doesnt care about the type of your data
  //   '''
  check_type(data) { }
}