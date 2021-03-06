import * as cassandra from 'cassandra-driver'

const UnderscoreCqlToCamelCaseMappings = cassandra.mapping.UnderscoreCqlToCamelCaseMappings;

export const modelsOption: cassandra.mapping.MappingOptions = {
  models: {
    'Activity': {
      keyspace: 'stream',
      tables: ['feeds'],
      mappings: new UnderscoreCqlToCamelCaseMappings()
    },
  }
}

export const models = {
  Activity: 'Activity',
  AggregatedActivity: 'AggregatedActivity'
}


// import { CassandraActivitySerializer } from '../../serializers/cassandra/ActivitySerializer';
// import { getClient } from './connection';

// const Mapper = cassandra.mapping.Mapper;
// const Client = cassandra.Client
// const client = getClient()

// const mapper = new Mapper(client, {
//   models: {
//     'Activity': {
//       tables: ['feeds'],
//       mappings: new UnderscoreCqlToCamelCaseMappings()
//     },
//   }
// });

// const feedsMapper = mapper.forModel('Activity');

// class BaseActivity extends Model {
//   feed_id = columns.Ascii(primary_key = True, partition_key = True)
//   activityId = columns.VarInt(primary_key = True, clustering_order = 'desc')
// }

// class Activity extends BaseActivity {
//   actor = columns.Integer(required = False)
//   context = columns.Bytes(required = False)
//   object = columns.Integer(required = False)
//   target = columns.Integer(required = False)
//   time = columns.DateTime(required = False)
//   verb = columns.Integer(required = False)
// }

// class AggregatedActivity extends BaseActivity {
//   activities = columns.Bytes(required = False)
//   created_at = columns.DateTime(required = False)
//   group = columns.Ascii(required = False)
//   updated_at = columns.DateTime(required = False)
// }