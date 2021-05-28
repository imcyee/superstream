// from cassandra.cqlengine import connection
// from stream_framework import settings
import cassandra from 'cassandra-driver'

var client: cassandra.Client

export function getClient() {
  const client = setup_connection()
  return client
}

export function setup_connection() {
  if (!client) {
    client = new cassandra.Client({
      // contactPoints: ['h1', 'h2'],
      // only allow local to connect 
      // or else you have to open up port for it
      contactPoints: [
        '192.168.0.146:9042',
        // '127.0.0.1:9042',
      ],
      localDataCenter: 'datacenter',
      // keyspace: 'ks1'
    });


    /**
     * Creates a table and retrieves its information
     */
    client.connect()
      .then(function () {
        const query = `CREATE KEYSPACE IF NOT EXISTS stream WITH replication = 
          {'class': 'SimpleStrategy', 'replication_factor': '1' }`;
        return client.execute(query);
      })
      .then(function () {
        const query = `CREATE TABLE IF NOT EXISTS stream.feeds
           (
              feed_id ascii, 
              activity_id varint, 
              actor int, 
              extra_context blob, 
              object int,
              target int,
              time timestamp,
              verb int,
              activities blob,
              created_at timestamp,
              group ascii,
              updated_at timestamp, 
              PRIMARY KEY (feed_id, activity_id)
            ) 
            WITH CLUSTERING ORDER BY (activity_id DESC);
            `;
        return client.execute(query);
      })
      .then(function () {
        return client.metadata.getTable('stream', 'feeds');
      })
      .then(function (table) {
        console.log('Table information');
        console.log('- Name: %s', table.name);
        console.log('- Columns:', table.columns);
        console.log('- Partition keys:', table.partitionKeys);
        console.log('- Clustering keys:', table.clusteringKeys);
        // console.log('Shutting down');
        // return client.shutdown();
      })
      .then(async () => {

        const Mapper = cassandra.mapping.Mapper;
        const Client = cassandra.Client
        const UnderscoreCqlToCamelCaseMappings = cassandra.mapping.UnderscoreCqlToCamelCaseMappings;

        const client = getClient()

        const mapper = new Mapper(client, {
          models: {
            'Activity': {
              keyspace: 'stream',
              tables: ['feeds'],
              mappings: new UnderscoreCqlToCamelCaseMappings()
            },
          }
        });
        const feedsMapper = mapper.forModel('Activity');
        const insert = await feedsMapper.insert({
          feedId: '123',
          activityId: 456789
        })
        console.log('insert', insert);
        const result = await feedsMapper.find({
          feedId: '123',
          // activityId: 456789
        })
        console.log(result);
      })
      .catch(function (err) {
        console.error('There was an error', err);
        return client.shutdown().then(() => { throw err; });
      });
  }

  return client
  // connection.setup(
  //   hosts = settings.STREAM_CASSANDRA_HOSTS,
  //   consistency = settings.STREAM_CASSANDRA_CONSISTENCY_LEVEL,
  //   default_keyspace = settings.STREAM_DEFAULT_KEYSPACE,
  //       ** settings.CASSANDRA_DRIVER_KWARGS
  // )
}