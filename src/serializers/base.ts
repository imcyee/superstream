import { Activity, AggregatedActivity } from "../activity"
import { ValueError } from "../errors"


export class BaseSerializer {

  // '''
  // The base serializer class, only defines the signature for
  // loads and dumps
  // It serializes Activity objects
  // '''
  activity_class

  constructor({
    activity_class,
    ...kwargs
  }) {
    this.activity_class = activity_class
  }

  check_type(data) {
    if (!(data instanceof Activity)) {
      throw new ValueError(
        `we only know how to dump activities, not ${typeof (data)}`
      )
    }
  }

  loads(serialized_activity, options?) {
    const activity = serialized_activity
    return activity
  }

  dumps(activity, options?) {
    this.check_type(activity)
    return activity
  }
}

export class BaseAggregatedSerializer extends BaseSerializer {

  // '''
  // Serialized aggregated activities
  // '''
  // indicates if dumps returns dehydrated aggregated activities
  dehydrate = false
  aggregated_activity_class
  constructor({
    aggregated_activity_class,
    ...kwargs
  }) {
    super({
      activity_class: aggregated_activity_class,
      ...kwargs
    })
    this.aggregated_activity_class = aggregated_activity_class
  }

  check_type(data) {
    if (!(data instanceof AggregatedActivity)) {
      throw new ValueError(`we only know how to dump AggregatedActivity not ${data}`)
    }
  }
}