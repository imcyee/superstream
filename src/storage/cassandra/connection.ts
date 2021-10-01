// from cassandra.cqlengine import connection
// from stream_framework import settings
import cassandra from 'cassandra-driver'
import { runCassandraMigration } from './cassandra.migration'

var client: cassandra.Client
export function getClient() {
  client = setupCassandraConnection()
  return client
}

export function setupCassandraConnection(options: {
  host?: string,
  port?: string | number
} = {}) {
  if (!client) {
    var contactPoint = '192.168.0.146:9042'
    if (options.host && options.port) {
      contactPoint = `${options.host}:${options.port}`
    }



    client = new cassandra.Client({
      contactPoints: [contactPoint],
      // localDataCenter: 'datacenter',
      localDataCenter: 'datacenter1',
      // keyspace: 'ks1'
    });

    // runCassandraMigration()

    // Creates a table and retrieves its information
    client.connect()
  }

  return client
}