import { datetime_to_epoch, epoch_to_datetime } from "../utils"
import { ActivitySerializer } from "./activity_serializer"
import { BaseAggregatedSerializer } from "./base"



export class AggregatedActivitySerializer extends BaseAggregatedSerializer {

  // '''
  // Optimized version of the Activity serializer for AggregatedActivities

  // v3group;;created_at;;updated_at;;seen_at;;read_at;;aggregated_activities

  // Main advantage is that it prevents you from increasing the storage of
  // a notification without realizing you are adding the extra data

  // Depending on dehydrate it will either dump dehydrated aggregated activities
  // or store the full aggregated activity
  // '''
  // #: indicates if dumps returns dehydrated aggregated activities
  dehydrate = true
  identifier = 'v3'
  reserved_characters = [';', ',', ';;']
  date_fields = ['created_at', 'updated_at', 'seen_at', 'read_at']

  activity_serializer_class = ActivitySerializer

  dumps(aggregated) {
    this.check_type(aggregated)

    const activity_serializer = new this.activity_serializer_class(this.activity_class)
    // # start by storing the group
    const parts = [aggregated.group]
    check_reserved(aggregated.group, [';;'])

    // # store the dates
    for (const date_field of this.date_fields) {
      const value = aggregated?.date_field
      var epoch
      if (value) {
        // # keep the milliseconds
        epoch = datetime_to_epoch(value).toFixed(6)
      } else {
        epoch = -1
      }
      parts.push[epoch]
    }
    // # add the activities serialization
    var serialized_activities = []
    if (this.dehydrate) {
      if (!aggregated.dehydrated) {
        aggregated = aggregated.get_dehydrated()
      }
      serialized_activities = map(str, aggregated._activity_ids)
    } else {
      for (const activity of aggregated.activities) {
        const serialized = activity_serializer.dumps(activity)
        check_reserved(serialized, [';', ';;'])
        serialized_activities.push(serialized)
      }
    }
    const serialized_activities_part = serialized_activities.join(';')
    parts.push(serialized_activities_part)

    // # add the minified activities
    parts.push(aggregated.minimized_activities)

    // # stick everything together
    const serialized_aggregated = parts.join(';;')
    const serialized = `${this.identifier}${serialized_aggregated}`
    return serialized
  }
  loads(serialized_aggregated) {
    const activity_serializer = new this.activity_serializer_class(this.activity_class)
    try {
      serialized_aggregated = serialized_aggregated[2:]
      const parts = serialized_aggregated.split(';;')
      // # start with the group
      const group = parts[0]
      const aggregated = this.aggregated_activity_class(group)

      // # get the date and activities
      const date_dict = dict(zip(this.date_fields, parts[1: 5]))
      for (k, v of date_dict.items()) {
        var date_value = null
        if (v != '-1')
          date_value = epoch_to_datetime(parseFloat(v))
        aggregated[k] = date_value
        // setattr(aggregated, k, date_value)
      }
      // # write the activities
      const serializations = parts[5].split(';')
      if (this.dehydrate) {
        const activity_ids = list(map(int, serializations))
        aggregated._activity_ids = activity_ids
        aggregated.dehydrated = true
      } else {
        const activities = [activity_serializer.loads(s) for s of serializations]
        aggregated.activities = activities
        aggregated.dehydrated = false
      }
      // # write the minimized activities
      const minimized = parseInt(parts[6])
      aggregated.minimized_activities = minimized

      return aggregated
    } catch (err) {
      except Exception as e:
      msg = six.text_type(e)
      raise SerializationException(msg)
    }
  }
}

export class NotificationSerializer extends AggregatedActivitySerializer {
  // #: indicates if dumps returns dehydrated aggregated activities
  dehydrate = false
}