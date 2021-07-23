// from stream_framework.verbs import get_verb_by_id
// from stream_framework.serializers.base import BaseSerializer
// from stream_framework.utils.five import long_t
// import pickle

import { get_verb_by_id } from "../../verbs/utils"
import { BaseSerializer } from "../BaseSerializer"

// Cassandra serializer for activities. Note: unlike other serializers this serializer
// does not have symmetrical `dumps` and `loads` functions (eg. loads reads a dictionary
// and dumps returns a CQLEngine model instance)
export class CassandraActivitySerializer extends BaseSerializer {

  // model

  constructor({
    model,
    ActivityClass,
    ...kwargs
  }) { 
    super({ ActivityClass, ...kwargs })
    // this.model = model
  }

  dumps(activity) {
    this.checkType(activity)
    return {
      activity_id: activity.serializationId, // long_t(activity.serializationId),
      actor_id: activity.actorId,
      time: activity.time,
      // verb: activity.verb.id,
      verb_id: activity.verbId,
      object_id: activity.objectId,
      target_id: activity.targetId,
      extra_context: Buffer.from(JSON.stringify(activity.extraContext)) // pickle.dumps(activity.extraContext)
    }
  }

  loads(serializedActivity) {
    delete serializedActivity['activity_id']
    delete serializedActivity['feed_id']
    // serializedActivity['verb'] = get_verb_by_id(serializedActivity['verb'])
    // serializedActivity['verb'] = get_verb_by_id(serializedActivity['verb'])
    // serializedActivity['extra_context'] = pickle.loads(
    //   serializedActivity['extra_context']
    // )
    serializedActivity['extra_context'] = serializedActivity['extra_context']
      ? JSON.parse(serializedActivity['extra_context'].toString())
      : null

    //  pickle.loads(
    //       serializedActivity['extra_context']
    //  ) 

    return new this.ActivityClass({
      actor: serializedActivity.actor_id,
      verb: serializedActivity.verb_id,
      object: serializedActivity.object_id,
      target: serializedActivity.target_id,
      time: serializedActivity.time,
      extraContext: serializedActivity.extra_context
    })
  }
}