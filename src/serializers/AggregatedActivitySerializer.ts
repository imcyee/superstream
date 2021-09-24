import { SerializationException } from "../errors"
import { datetimeToEpoch, epochToDatetime } from "../utils"
import { ActivitySerializer } from "./ActivitySerializer"
import { BaseAggregatedSerializer } from "./BaseAggregatedSerializer"
import { checkReserved } from "./utils"

// Optimized version of the Activity serializer for AggregatedActivities
// v3group;;created_at;;updated_at;;seen_at;;read_at;;aggregatedActivities
// Main advantage is that it prevents you from increasing the storage of
// a notification without realizing you are adding the extra data
// Depending on dehydrate it will either dump dehydrated aggregated activities
// or store the full aggregated activity
export class AggregatedActivitySerializer extends BaseAggregatedSerializer {

  // #: indicates if dumps returns dehydrated aggregated activities
  dehydrate = true
  identifier = 'v3'
  reservedCharacters = [';', ',', ';;']
  dateFields = ['created_at', 'updated_at', 'seen_at', 'read_at']

  ActivitySerializerClass = ActivitySerializer

  dumps(aggregated) {
    this.checkType(aggregated)

    const activitySerializer = new this.ActivitySerializerClass(this.ActivityClass)
    // # start by storing the group
    const parts = [aggregated.group]
    checkReserved(aggregated.group, [';;'])


    // # store the dates
    for (const dateField of this.dateFields) {
      const value = aggregated?.[dateField]
      var epoch
      if (value) {
        // # keep the milliseconds
        epoch = datetimeToEpoch(value).toFixed(6)
      } else {
        epoch = -1
      }
      parts.push(epoch)
    }
    // # add the activities serialization
    var serializedActivities = []
    if (this.dehydrate) {
      if (!aggregated.dehydrated) {
        aggregated = aggregated.getDehydated()
      }
      serializedActivities = aggregated._activityIds// map(str, aggregated._activityIds)
    } else {
      for (const activity of aggregated.activities) {
        const serialized = activitySerializer.dumps(activity)
        checkReserved(serialized, [';', ';;'])
        serializedActivities.push(serialized)
      }
    }
    const serializedActivities_part = serializedActivities.join(';')
    parts.push(serializedActivities_part)

    // # add the minified activities
    parts.push(aggregated.minimizedActivities)

    // # stick everything together
    const serializedAggregated = parts.join(';;')
    const serialized = `${this.identifier}${serializedAggregated}`

    return serialized
  }

  loads(serializedAggregated) {
    console.log('serializedAggregated', serializedAggregated);
    const activitySerializer = new this.ActivitySerializerClass({ ActivityClass: this.ActivityClass })
    try {

      serializedAggregated = serializedAggregated.slice(2)

      const parts = serializedAggregated.split(';;')
      // # start with the group
      const group = parts[0]

      const aggregated = new this.AggregatedActivityClass(group)
      // const aggregated = new AggregatedActivity(group)

      // # get the date and activities
      const slicedParts = parts.slice(1, 5)
      const date_dict = this.dateFields.map(function (e, i) {
        return [e, slicedParts[i]];
      });

      // dict(zip(this.dateFields, parts.slice(1, 5)))
      for (const date_dict_tuple of date_dict) {
        const [k, v] = date_dict_tuple
        var date_value = null
        if (v != '-1')
          date_value = epochToDatetime(parseFloat(v))
        aggregated[k] = date_value
        // setattr(aggregated, k, date_value)
      }
      // # write the activities
      const serializations = parts[5].split(';')

      if (this.dehydrate) {
        // don't parse it to number or else we will need bigInt
        // or we get truncated id eg: 1.3567e21
        const activityIds = serializations.map((sl) => sl)
        // const activityIds = serializations.map((sl) => Number(sl))
        aggregated._activityIds = activityIds
        aggregated.dehydrated = true
      } else {
        const activities = []
        for (const s of serializations) {
          activities.push(activitySerializer.loads(s))
        }
        // const activities = [activitySerializer.loads(s) for s of serializations]
        aggregated.activities = activities
        aggregated.dehydrated = false
      }
      // # write the minimized activities
      const minimized = parseInt(parts[6])
      aggregated.minimizedActivities = minimized

      return aggregated
    } catch (err) {
      // except Exception as e:
      const msg = err
      throw new SerializationException(msg)
    }
  }
}

// #: indicates if dumps returns dehydrated aggregated activities
export class NotificationSerializer extends AggregatedActivitySerializer {
  dehydrate = false
}