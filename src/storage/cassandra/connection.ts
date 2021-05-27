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
      contactPoints: ['h1'],
      localDataCenter: 'datacenter1',
      keyspace: 'ks1'
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