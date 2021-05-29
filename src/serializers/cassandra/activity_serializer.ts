// from stream_framework.verbs import get_verb_by_id
// from stream_framework.serializers.base import BaseSerializer
// from stream_framework.utils.five import long_t
// import pickle

import { get_verb_by_id } from "../../verbs/utils"
import { BaseSerializer } from "../base"


export class CassandraActivitySerializer extends BaseSerializer {
  // '''
  // Cassandra serializer for activities. Note: unlike other serializers this serializer
  // does not have symmetrical `dumps` and `loads` functions (eg. loads reads a dictionary
  // and dumps returns a CQLEngine model instance)
  // '''

  // model

  constructor({
    model,
    activity_class,
    ...kwargs
  }) {
    console.log('activity class ', activity_class);
    super({ activity_class, ...kwargs })
    // this.model = model
  }

  dumps(activity) {
    this.check_type(activity)
    return {
      activity_id: activity.serialization_id, // long_t(activity.serialization_id),
      actor_id: activity.actor_id,
      time: activity.time,
      // verb: activity.verb.id,
      verb_id: activity.verb_id,
      object_id: activity.object_id,
      target_id: activity.target_id,
      extra_context: Buffer.from(JSON.stringify(activity.extra_context)) // pickle.dumps(activity.extra_context)
    }
  }

  loads(serialized_activity) {
    console.log('serialized_activity', serialized_activity);
    delete serialized_activity['activity_id']
    delete serialized_activity['feed_id']
    // serialized_activity['verb'] = get_verb_by_id(serialized_activity['verb'])
    // serialized_activity['verb'] = get_verb_by_id(serialized_activity['verb'])
    // serialized_activity['extra_context'] = pickle.loads(
    //   serialized_activity['extra_context']
    // )
    serialized_activity['extra_context'] = serialized_activity['extra_context']
      ? JSON.parse(serialized_activity['extra_context'].toString())
      : null

    //  pickle.loads(
    //       serialized_activity['extra_context']
    //  )
    console.log(this.activity_class);

    return new this.activity_class({
      actor: serialized_activity.actor_id,
      verb: serialized_activity.verb_id,
      object: serialized_activity.object_id,
      target: serialized_activity.target_id,
      time: serialized_activity.time,
      extra_context: serialized_activity.extra_context
    })
  }
}