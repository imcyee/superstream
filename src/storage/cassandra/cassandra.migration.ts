// from cassandra.cqlengine import connection
// from stream_framework import settings
import cassandra from 'cassandra-driver'
import { getClient } from './connection';

var client: cassandra.Client

type CQLFeed = {
  feed_id: string,
  activity_id: number,
  actor_id: string,
  context: any // blob,
  object_id: string,
  targetId: string,
  time: Date,
  verb_id: string,
  activities: any // blob,
  created_at: Date,
  group: string,
  updated_at: Date,
  // PRIMARY KEY(feed_id, activity_id)
}

export async function runCassandraMigration() {
  const client = getClient()

  /**
   * Creates a table and retrieves its information
   */
  await client.connect()
    .then(function () {
      const query = `CREATE KEYSPACE IF NOT EXISTS stream WITH replication = 
        {'class': 'SimpleStrategy', 'replication_factor': '1' }`;
      return client.execute(query);
    })
    .then(async function () {
      const delete_it_query = `DROP TABLE IF EXISTS stream.feeds`
      await client.execute(delete_it_query);
      // const query = `CREATE TABLE IF NOT EXISTS stream.feeds
      //    (
      //       feed_id ascii, 
      //       activity_id varint, 
      //       actor_id ascii, 
      //       context blob, 
      //       object_id ascii,
      //       targetId ascii,
      //       time timestamp,
      //       verb_id ascii,
      //       activities blob,
      //       created_at timestamp,
      //       group ascii,
      //       updated_at timestamp, 
      //       PRIMARY KEY (feed_id, activity_id)
      //     ) 
      //     WITH CLUSTERING ORDER BY (activity_id DESC);
      //     `;
      const query = `CREATE TABLE IF NOT EXISTS stream.feeds
         (
            feed_id ascii, 
            activity_id timeuuid, 
            actor_id ascii, 
            context blob, 
            object_id ascii,
            target_id ascii,
            time timestamp,
            verb_id ascii,
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
    .catch(function (err) {
      console.error('There was an error', err);
      return client.shutdown().then(() => { throw err; });
    });
}
