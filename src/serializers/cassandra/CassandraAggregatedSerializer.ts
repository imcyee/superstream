// from stream_framework.serializers.aggregated_activity_serializer import AggregatedActivitySerializer
// from stream_framework.utils.five import long_t
// import pickle

import { AggregatedActivitySerializer } from "../AggregatedActivitySerializer"


// '''
// Cassandra serializer for aggregated activities. Note: unlike other serializers this serializer
// does not have symmetrical `dumps` and `loads` functions (eg. loads reads a dictionary
// and dumps returns a CQLEngine model instance)
// '''
export class CassandraAggregatedActivitySerializer extends AggregatedActivitySerializer {
  // private model

  // constructor(model, args) {
  // constructor({
  //   // model,

  //   ...args
  // }) {

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


    // super({ ...args })
    // AggregatedActivitySerializer.__init__(args)
    // this.model = model
  }

  dumps(aggregated) {
    // const activities = pickle.dumps(aggregated.activities)
    const activities = aggregated.activities
    // const model_instance = this.model(
    //   activity_id = long_t(aggregated.serialization_id),
    //   activities = activities,
    //   group = aggregated.group,
    //   created_at = aggregated.created_at,
    //   updated_at = aggregated.updated_at
    // )
    // return model_instance
    const model_instance = {
      activity_id: aggregated.serializationId,
      activities: activities,
      group: aggregated.group,
      created_at: aggregated.created_at,
      updated_at: aggregated.updated_at
    }
    return model_instance
  }
  loads(serialized_aggregated) {
    /**
     * pickle is almost same as JSON.stringify or parse
     * it is for python
     * and unlike json it is converted to bytestream
     */
    // const activities = pickle.loads(serialized_aggregated['activities'])
    const activities = serialized_aggregated['activities']
    const aggregated = new this.AggregatedActivityClass(
      serialized_aggregated['group'],
      activities,
      serialized_aggregated['created_at'],
      serialized_aggregated['updated_at'],
    )
    return aggregated
  }
}