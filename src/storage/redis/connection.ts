import * as redis from 'redis'

var connection: redis.RedisClientType

export function getRedisConnection(serverName: string = 'default') {
  // Gets the specified redis connection
  // global connection_pool
  if (!connection) {
    const pool = setupRedis()
    // @ts-ignore
    connection = pool
  }
  return connection
}

let config: { host: string, port: number }

/** Any get address call before setup will be falsy */
let hasBeenSetup = false

export function setupRedisConfig(props: {
  port,
  host
}) {
  // merging
  config = {
    ...config,
    ...props
  }
  hasBeenSetup = true
  return
}

export function getRedisAddress() {
  const port = config?.port ?? process.env.REDIS_PORT ?? 6379
  const host = config?.host ?? process.env.REDIS_HOST ?? 'redis'
  return {
    address: `redis://${host}:${port}`,
    port,
    host
  }
}

export function setupRedis() {
  const pool = redis.createClient({
    url: getRedisAddress().address
  })

  pool
    .connect()
    .then(() => {
      console.log('Redis connected');
    }).catch(err => {
      console.log('err', err);
    })
  return pool
}
