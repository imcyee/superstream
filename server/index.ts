import { setupMockEnvironment, startServer } from "./server";
import { getStorageName } from "./utils/getStorageName";

var storageName = getStorageName('redis')

const redisPort = process.env.REDIS_PORT
const redisHost = process.env.REDIS_HOST

startServer({
  storageName,
  redisPort,
  redisHost,
})