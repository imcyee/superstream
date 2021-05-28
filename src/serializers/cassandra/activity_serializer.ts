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
    super({ activity_class, ...kwargs })
    // this.model = model
  }

  dumps(activity) {
    this.check_type(activity)
    return {
      activity_id: activity.serialization_id, // long_t(activity.serialization_id),
      actor: activity.actor_id,
      time: activity.time,
      verb: activity.verb.id,
      object: activity.object_id,
      target: activity.target_id,
      extra_context: activity.extra_context// pickle.dumps(activity.extra_context)
    }
  }

  loads(serialized_activity) {
    serialized_activity.pop('activity_id')
    serialized_activity.pop('feed_id')
    serialized_activity['verb'] = get_verb_by_id(serialized_activity['verb'])
    // serialized_activity['extra_context'] = pickle.loads(
    //   serialized_activity['extra_context']
    // )
    return this.activity_class(
      serialized_activity.actor_id,
      serialized_activity.verb,
      serialized_activity.object_id,
      serialized_activity.target_id,
      serialized_activity.time,
      serialized_activity.extra_context
    )
  }
}