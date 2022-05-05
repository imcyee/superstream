import { Queue } from 'bullmq'
import { getRedisAddress } from "./storage/redis/connection"

export const queueNames = {
  fanoutQueue: "fanout_operation",
  fanoutHighPriorityQueue: "fanoutOperationHiPriority",
  fanoutLowPriorityQueue: "fanoutOperationLowPriority",
  unfollowManyQueue: "unfollowManyQueue",
  followManyQueue: "followManyQueue"
}

const redisAddress = getRedisAddress()
let connection = {
  host: 'localhost',
  port: 6379
}

export function getConnection() {
  if (connection)
    return connection
  const redisAddress = getRedisAddress()
  // connection = new IORedis(redisAddress);
  return connection
}
export const fanoutQueue = new Queue(queueNames.fanoutQueue, { connection })
export const fanoutHighPriorityQueue = new Queue(queueNames.fanoutHighPriorityQueue, { connection })
export const fanoutLowPriorityQueue = new Queue(queueNames.fanoutLowPriorityQueue, { connection })
export const followManyQueue = new Queue(queueNames.followManyQueue, { connection })
export const unfollowManyQueue = new Queue(queueNames.unfollowManyQueue, { connection })

