import { Worker } from "bullmq"
import createDebug from 'debug'
import { chunk } from 'lodash'
import { Activity } from "./activity/Activity"
import { AggregatedActivity } from "./activity/AggregatedActivity"
import { managerRegistration } from "./feedManagers/manager_registration"
import { BaseFeed } from "./feeds/base/base"
import { getSeparator } from "./feeds/config"
import { UserBaseFeed } from "./feeds/UserBaseFeed"
import { getConnection, queueNames } from "./task_registration"
import { Guard } from "./utils/Guard"
import { splitId } from "./utils/splitId"

const debug = createDebug('ns:debug:base')

/**
 * Why do we need to register feed/operations etc
 * For one it is because in js class object serialization 
 * does not work in js compare to python pickle 
 * hence we will have to register these 
 * and recreate it
 */

const operationRegistration = {
  addOperation,
  removeOperation
}

type OperationArgs<T = Activity> = {
  activities: T[]
  trim?: boolean,
  batchInterface?
}

export interface FollowDataType {
  feedManagerName: string
  userId: string
  targetIds: string[]
}

export interface FollowManyDataType extends FollowDataType {
  follow_activity_limit: number
}


export type FanoutDataType = {
  feedManagerName: string,
  followerIds: string[],
  operationName: "addOperation" | "removeOperation"
  operationArgs: OperationArgs<ReturnType<Activity["toJSON"]>> | OperationArgs
}

export const connection = getConnection()

// Operation
// '''
// Add the activities to the feed
// functions used in tasks need to be at the main level of the module
// '''
export async function addOperation(
  feed,
  operationArgs: OperationArgs
) {
  const { activities, trim = true, batchInterface = null } = operationArgs
  const time = new Date().getTime()
  const msg_format = (a, b, c, d) => `running ${a}.addMany operation for ${b} activities batch interface ${c} and trim ${d}`
  debug(msg_format(feed, activities.length, batchInterface, trim))
  await feed.addMany(activities, { batchInterface, trim })
  const now = new Date().getTime()
  const elapsedInSeconds = (now - time) / 1000
  debug(`add many operation took ${elapsedInSeconds} seconds`)
}


// '''
// Remove the activities from the feed
// functions used in tasks need to be at the main level of the module
// '''
export async function removeOperation(feed, operationArgs: OperationArgs
) {
  const { activities, trim = true, batchInterface = null } = operationArgs
  const time = new Date().getTime()
  const msg_format = (a, b, c) => `running ${a}.removeMany operation for ${b} activities batch interface ${c}`
  debug(msg_format(feed, activities.length, batchInterface))
  await feed.removeMany(activities, { trim, batchInterface })
  const now = new Date().getTime()
  const elapsedInSeconds = (now - time) / 1000
  debug(`remove many operation took ${elapsedInSeconds} seconds`)
}


export const fanoutWorker = new Worker<FanoutDataType>(
  queueNames.fanoutQueue,
  async (job) => {
    const {
      feedManagerName,
      followerIds,
      operationName,
      operationArgs
    } = job.data

    debug("Handling fanout")

    const result = Guard.againstNullOrUndefinedBulk([
      { argumentName: 'operationName', argument: operationName },
      { argumentName: 'feedManagerName', argument: feedManagerName },
    ])
    if (!result.succeeded)
      throw new Error(result.message)
 
    const ManagerClass = managerRegistration[feedManagerName];
    if (!ManagerClass)
      throw new Error("Unable to find manager class in Manager Registration.")

    // Convert back to Activity
    // make sure activities in operationArgs are in Activity
    operationArgs.activities = operationArgs.activities.map((a) => {
      return new Activity(a)
    })

    const manager = new ManagerClass();
    for await (const FeedClass of Object.values(manager.FeedClasses)) {
      const chunk_size = manager.fanoutChunkSize
      const userIds_chunks = chunk(followerIds, chunk_size)
      const msg_format = (userIds_chunks_length, followerIdsLength, chunk_size) =>
        `spawning ${userIds_chunks_length} subtasks for ${followerIdsLength} user ids in chunks of ${chunk_size} users`

      debug(msg_format(userIds_chunks.length, followerIds.length, chunk_size))

      // var tasks = []
      // # now actually create the tasks 
      for await (const ids_chunk of userIds_chunks) {
        const operation = operationRegistration[operationName];
        // Simple task wrapper for _fanout task
        // Just making sure code is where you expect it :)
        manager.fanout(ids_chunk, FeedClass, operation, operationArgs)
        const format = (a, b, c, d) => `${a} userIds, ${b}, ${c} ${d}`
        return format(ids_chunk.length, FeedClass, operation, operationArgs)
      }
      // return tasks
    }
  }, { connection })



/**
 * 🔥 There is a issue here with follow many 
 * Whatever activity is in user feed is also in follower feed.
 * Include feed that is follow by others
 * @param feedManager 
 * @param userId 
 * @param targetIds 
 * @param follow_activity_limit 
 */
// @shared_task
export const followManyWorker = new Worker<FollowManyDataType>(
  queueNames.followManyQueue,
  async (job) => {
    const { feedManagerName, userId, targetIds, follow_activity_limit } = job.data

    const result = Guard.againstNullOrUndefinedBulk([
      { argumentName: 'userId', argument: userId },
      { argumentName: 'feedManagerName', argument: feedManagerName },
    ])
    if (!result.succeeded)
      throw new Error(result.message)

    const ManagerClass = managerRegistration[feedManagerName];
    if (!ManagerClass)
      throw new Error("Unable to find manager class in Manager Registration.")

    const feedManager = new ManagerClass();

    const feeds = Object.values(feedManager.getFeeds(userId)) 
    const targetFeeds: UserBaseFeed[] = targetIds.map((targetId) => feedManager.getUserFeed(targetId))

    const activities = []
 
    for await (const targetFeed of targetFeeds) {
      const separator = getSeparator()
      const feedItems = await targetFeed.getItem(0, follow_activity_limit) 
      // only wants the activity created by target user actorId or targetId
      const filteredFeedItems = feedItems.filter((f) => {
        // if (!separator)
        //   return f.actorId === targetFeed.userId || f.targetId === targetFeed.userId
        // const splitted = f.actorId.split(separator)
        // const actorId = splitted?.length
        //   ? splitted.at(-1)
        //   : f.actorId

        const actorId = splitId(f.actorId, separator)
        const targetId = splitId(f.targetId, separator)
        const targetUserId = targetFeed.userId
        return actorId === targetUserId || targetId === targetUserId
      })

      activities.push(...filteredFeedItems)
    }

    console.log('activities', activities);
    if (activities) {
      for await (const feed of feeds) {
        // 🔥 re-add batch interface
        // const batch_interface = feed.getTimelineBatchInterface()
        // feed.addMany(activities, { batch_interface })
        await (feed as any).addMany(activities)
      }
    }
  }, { connection })


// @shared_task
/**
 * 🔥 There is a issue here
 * Removal of activity after unsubscribe is based on actorId
 * But our actor can be anything with a prefix:id
 * 
 * and also assumption that actor is the one who created the activity
 * 
 * supplying only id is not enough 
 * @param feedManager 
 * @param userId 
 * @param sourceIds 
 */
export const unfollowManyWorker = new Worker<FollowManyDataType>(
  queueNames.unfollowManyQueue,
  async (job) => {

    const { feedManagerName, userId, targetIds: sourceIds } = job.data

    const result = Guard.againstNullOrUndefinedBulk([
      { argumentName: 'userId', argument: userId },
      { argumentName: 'feedManagerName', argument: feedManagerName },
    ])
    if (!result.succeeded)
      throw new Error(result.message)

    const ManagerClass = managerRegistration[feedManagerName];
    if (!ManagerClass)
      throw new Error("Unable to find manager class in Manager Registration.")

    const feedManager = new ManagerClass();

    const feeds: BaseFeed[] = Object.values(feedManager.getFeeds(userId))
    const separator = getSeparator()
    for (const feed of feeds) {
      const activities: Activity[] = []
      console.log('calling trim');
      await feed.trim()
      console.log('calling trim after');
      const items = await feed.getItem(0, feed.maxLength)
      console.log(items);
      console.log('');
      for (const item of items) {
        const pureActorId = splitId(item.actorId, separator)
        const pureTargetId = splitId(item.targetId, separator)
        console.log(pureActorId);
        console.log(pureTargetId);
        console.log(item instanceof Activity);
        if (item instanceof Activity) {
          // if (sourceIds.includes(item.actorId))
          if (sourceIds.includes(pureActorId) || sourceIds.includes(pureTargetId))
            activities.push(item)
        } else if (item instanceof AggregatedActivity) {
          // activities.extend([activity for activity in item.activities if activity.actorId in sourceIds])
          // const filteredActivities = item.activities.filter((a) => sourceIds.includes(a.actorId))
          const filteredActivities = item.activities.filter((a) => (
            sourceIds.includes(pureActorId)
            || sourceIds.includes(pureTargetId)
          ))
          activities.push(...filteredActivities)
        }
      }
      if (activities.length) {
        const activityIds = activities.map((a) => a.serializationId)
        console.log(activityIds);
        await feed.removeMany(activityIds, {})
      }
    }
  }, { connection })

