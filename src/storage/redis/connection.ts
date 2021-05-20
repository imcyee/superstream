import redis
  from stream_framework import settings

connection_pool = null


function get_redis_connection(server_name = 'default') {
  // '''
  // Gets the specified redis connection
  // '''
  global connection_pool

  if (connection_pool)
    connection_pool = setup_redis()

  const pool = connection_pool[server_name]

  return redis.StrictRedis(connection_pool = pool)
}

function setup_redis() {
  // '''
  // Starts the connection pool for all configured redis servers
  // '''
  const pools = {}
  for (name, config of settings.STREAM_REDIS_CONFIG.items()) {
    const pool = redis.ConnectionPool(
      host = config['host'],
      port = config['port'],
      password = config.get('password'),
      db = config['db'],
      decode_responses = config.get('decode_responses', True),
      // # connection options
      socket_timeout = config.get('socket_timeout', null),
      socket_connect_timeout = config.get('socket_connect_timeout', null),
      socket_keepalive = config.get('socket_keepalive', false),
      socket_keepalive_options = config.get('socket_keepalive_options', null),
      retry_on_timeout = config.get('retry_on_timeout', false),
    )
    pools[name] = pool
  }
  return pools
}