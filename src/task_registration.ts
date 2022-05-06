import { Queue } from 'bullmq'
import { getRedisAddress } from "./storage/redis/connection"
import { FanoutDataType, FollowDataType, FollowManyDataType } from './task'

export const queueNames = {
  fanoutQueue: "fanoutOperation",
  unfollowManyQueue: "unfollowManyQueue",
  followManyQueue: "followManyQueue"
}

let connection = {
  host: 'localhost',
  port: 6379
}

export function getConnection() {
  return connection
}
export const fanoutQueue = new Queue<FanoutDataType>(queueNames.fanoutQueue, { connection })
export const followManyQueue = new Queue<FollowManyDataType>(queueNames.followManyQueue, { connection })
export const unfollowManyQueue = new Queue<FollowDataType>(queueNames.unfollowManyQueue, { connection })

