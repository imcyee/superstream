// from cassandra.cqlengine import connection
// from stream_framework import settings
import cassandra from 'cassandra-driver'
import { runCassandraMigration } from './cassandra_migration'

var client: cassandra.Client 
export function getClient() {

  const client = setup_connection()
  return client
}

export function setup_connection() {
  if (!client) {
    client = new cassandra.Client({
      contactPoints: ['192.168.0.146:9042'],
      localDataCenter: 'datacenter',
      // keyspace: 'ks1'
    });

    /**
     * Creates a table and retrieves its information
     */
    client.connect()
  }

  return client
}