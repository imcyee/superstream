import { AggregatedActivity } from "../activity/AggregatedActivity";
import { ValueError } from "../errors";
import { BaseSerializer } from "./BaseSerializer";

// Serialized aggregated activities
export class BaseAggregatedSerializer extends BaseSerializer {

  // indicates if dumps returns dehydrated aggregated activities
  dehydrate = false
  AggregatedActivityClass

  constructor({
    AggregatedActivityClass: AggregatedActivityClass,
    ActivityClass,
    ...kwargs
  }) {
    super({
      AggregatedActivityClass: AggregatedActivityClass,
      ActivityClass,
      ...kwargs
    })
    
    this.AggregatedActivityClass = AggregatedActivityClass
  }

  checkType(data) {
    if (!(data instanceof AggregatedActivity)) {
      throw new ValueError(`we only know how to dump AggregatedActivity not ${data}`)
    }
  }
}