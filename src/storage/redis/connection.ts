// import redis
//   from stream_framework import settings
import * as redis from 'redis'
import { RedisClientType } from 'redis/dist/lib/client'

var connection_pool = null
var connection: RedisClientType

export function getRedisConnection(serverName: string = 'default') {
  // 
  // // Gets the specified redis connection
  // 
  // global connection_pool
  if (!connection) {
    const pool = setupRedis()
    // @ts-ignore
    // const asyncRedisClient = asyncRedis.decorate(pool);

    connection = pool
    // connection = asyncRedisClient
  }
  return connection
  // const pool = connection_pool[serverName]
  // return redis.StrictRedis(connection_pool = pool)
  // return redis.StrictRedis(connection_pool = pool)
}


let config = {}

export function setupConfig(_config: {
  port,
  host
}) {
  config = {
    ...config,
    ..._config
  }
  return
}

export function setupRedis() {
  // Starts the connection pool for all configured redis servers
  // const pool = redis.createClient(
  //   config['port'] || 6379,
  //   config['host'] || 'redis'
  // )

  // const pool = redis.createClient({
  //   socket: {
  //     port: config['port'] || 6379,
  //     host: config['host'] || 'redis'
  //   }
  // })


  const port = config['port'] || 6379
  const host = config['host'] || 'redis'
  console.log('url', `redis://${host}:${port}`);
  const pool = redis.createClient({
    url: `redis://${host}:${port}`
    // socket: {
    //   port: config['port'] || 6379,
    //   host: config['host'] || 'redis'
    // }
  })
  pool.connect().then(() => {
    console.log('connected');
  }).catch(err => {
    console.log('err', err);
  })
  return pool
}

// getRedisConnection()



// export function getRedisConnection(serverName = 'default') {
//   // 
//   // // Gets the specified redis connection
//   // 
//   // global connection_pool

//   if (connection_pool)
//     connection_pool = setupRedis()

//   const pool = connection_pool[serverName]

//   return redis.StrictRedis(connection_pool = pool)
// }

// export function setupRedis() {
//   
//   // Starts the connection pool for all configured redis servers
//   
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
