// import redis
//   from stream_framework import settings
import * as redis from 'redis'
var connection_pool = null
var connection: redis.RedisClient;

export function get_redis_connection(server_name: string = 'default') {
  // // '''
  // // Gets the specified redis connection
  // // '''
  // global connection_pool

  if (connection)
    connection = setup_redis()

  return connection
  // const pool = connection_pool[server_name]
  // return redis.StrictRedis(connection_pool = pool)
  // return redis.StrictRedis(connection_pool = pool)
}


const config = {

}

export function setup_redis() {
  // '''
  // Starts the connection pool for all configured redis servers
  // '''
  // const pools = {}
  // for (name, config of settings.STREAM_REDIS_CONFIG.items()) {

  const pool = redis.createClient(
    config['port'] || 6379,
    config['host'] || 'redis'
    // "192.168.0.146"
    // config['host'],
    // {
    //   // host = config['host'],
    //   // port = config['port'],
    //   password: config['password'] || "redis",
    //   db: config['db'] || 0,
    //   // decode_responses: config.get('decode_responses', true),
    //   // # connection options
    //   // socket_timeout: config.get('socket_timeout', null),
    //   // socket_connect_timeout: config.get('socket_connect_timeout', null),
    //   socket_keepalive: config['socket_keepalive'] || false,
    //   // socket_keepalive_options: config.get('socket_keepalive_options', null),
    //   // retry_on_timeout: config.get('retry_on_timeout', false),
    // }
  )
  // pools[name] = pool
  // }
  return pool
}

// export function get_redis_connection(server_name = 'default') {
//   // // '''
//   // // Gets the specified redis connection
//   // // '''
//   // global connection_pool

//   if (connection_pool)
//     connection_pool = setup_redis()

//   const pool = connection_pool[server_name]

//   return redis.StrictRedis(connection_pool = pool)
// }

// export function setup_redis() {
//   // '''
//   // Starts the connection pool for all configured redis servers
//   // '''
//   const pools = {}
//   for (name, config of settings.STREAM_REDIS_CONFIG.items()) {

//     const pool = redis.createClient(
//       config['port'],
//       config['host'],
//       {
//         // host = config['host'],
//         // port = config['port'],
//         password = config.get('password'),
//         db = config['db'],
//         decode_responses = config.get('decode_responses', true),
//         // # connection options
//         socket_timeout = config.get('socket_timeout', null),
//         socket_connect_timeout = config.get('socket_connect_timeout', null),
//         socket_keepalive = config.get('socket_keepalive', false),
//         socket_keepalive_options = config.get('socket_keepalive_options', null),
//         retry_on_timeout = config.get('retry_on_timeout', false),
//       })
//     pools[name] = pool
//   }
//   return pools
// }
