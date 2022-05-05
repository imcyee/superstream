import { Job, Worker } from "bullmq"
import createDebug from 'debug'
import { chunk } from 'lodash'
import { Activity } from "./activity/Activity"
import { AggregatedActivity } from "./activity/AggregatedActivity"
import { managerRegistration } from "./feedManagers/manager_registration"
import { BaseFeed } from "./feeds/base/base"
import { getSeparator } from "./feeds/config"
import { UserBaseFeed } from "./feeds/UserBaseFeed"
import { getConnection, queueNames } from "./task_registration"
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

// Operation
// '''
// Add the activities to the feed
// functions used in tasks need to be at the main level of the module
// '''
export async function addOperation(
  feed,
  {
    activities,
    trim = true,
    batchInterface = null
  }) {
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
export async function removeOperation(feed, {
  activities,
  trim = true,
  batchInterface = null
}) {
  const time = new Date().getTime()
  const msg_format = (a, b, c) => `running ${a}.removeMany operation for ${b} activities batch interface ${c}`
  debug(msg_format(feed, activities.length, batchInterface))
  await feed.removeMany(activities, { trim, batchInterface })
  const now = new Date().getTime()
  const elapsedInSeconds = (now - time) / 1000
  debug(`remove many operation took ${elapsedInSeconds} seconds`)
}



const handleFanout = async ({
  feedManagerName,
  follower_ids,
  operationName,
  operation_kwargs,
  fanout_priority
}) => {

  console.log('handleFanout', feedManagerName);
  // newly added
  // make sure activities in operation_kwargs are in Activity
  operation_kwargs.activities = operation_kwargs.activities.map((a) => {
    console.log(a);
    return new Activity(a)
  })

  console.log('operation_kwargs', operation_kwargs);

  if (!feedManagerName)
    throw new Error(`Please provide feedManagerName. ${feedManagerName}`)

  const ManagerClass = managerRegistration[feedManagerName];
  console.log('ManagerClass', ManagerClass);
  if (!ManagerClass)
    throw new Error("Unable to find manager class in Manager Registration.")

  const manager = new ManagerClass();
  console.log('ManagerClass', manager);
  for await (const FeedClass of Object.values(manager.FeedClasses)) {
    const fanoutTask = manager.getFanoutTask(fanout_priority, FeedClass)
    if (!fanoutTask)
      return []
    const chunk_size = manager.fanoutChunkSize
    // const userIds_chunks = list(chunks(follower_ids, chunk_size))
    const userIds_chunks = chunk(follower_ids, chunk_size)
    const msg_format = 'spawning ${} subtasks for ${} user ids in chunks of ${} users'
    // logger.info(
    //     msg_format, len(userIds_chunks), len(follower_ids), chunk_size)
    // var tasks = []
    // # now actually create the tasks
    console.log('userIds_chunks', userIds_chunks);
    for await (const ids_chunk of userIds_chunks) {
      const operation = operationRegistration[operationName];
      // Simple task wrapper for _fanout task
      // Just making sure code is where you expect it :)
      manager.fanout(ids_chunk, FeedClass, operation, operation_kwargs)
      const format = (a, b, c, d) => { return `${a} userIds, ${b}, ${c} ${d}` }
      return format(ids_chunk.length, FeedClass, operation, operation_kwargs)

      // const task = fanoutTask.delay(
      //   feedManager = this,
      //   FeedClass = FeedClass,
      //   userIds = ids_chunk,
      //   operation = operation,
      //   operation_kwargs = operation_kwargs
      // )
      // tasks.push(task)
    }
    // return tasks
  }
}

export const connection = getConnection()
export const fanoutWorker = new Worker(queueNames.fanoutQueue, async (job: Job) => {
  const {
    feedManagerName,
    follower_ids,
    operationName,
    operation_kwargs = null,
    fanout_priority = null
  } = job.data
  await handleFanout({
    feedManagerName,
    follower_ids,
    // feedClassName,
    operationName,
    operation_kwargs,
    fanout_priority
  })
}, { connection })

export const fanoutHighWorker = new Worker(queueNames.fanoutHighPriorityQueue, async (job: Job) => {
  const {
    feedManagerName,
    follower_ids,
    // feedClassName,
    operationName,
    operation_kwargs = null,
    fanout_priority = null
  } = job.data
  await handleFanout({
    feedManagerName,
    follower_ids,
    // feedClassName,
    operationName,
    operation_kwargs,
    fanout_priority
  })
}, { connection })

export const fanoutLowWorker = new Worker(queueNames.fanoutLowPriorityQueue, async (job: Job) => {
  const {
    feedManagerName,
    follower_ids,
    // feedClassName,
    operationName,
    operation_kwargs = null,
    fanout_priority = null
  } = job.data
  await handleFanout({
    feedManagerName,
    follower_ids,
    // feedClassName,
    operationName,
    operation_kwargs,
    fanout_priority
  })
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
export const followManyWorker = new Worker(queueNames.followManyQueue, async (job: Job) => {

  console.log('following many');
  const { feedManagerName, userId, targetIds, follow_activity_limit } = job.data
  console.log(userId);
  if (!feedManagerName)
    throw new Error(`Please provide feedManagerName. ${feedManagerName}`)

  const ManagerClass = managerRegistration[feedManagerName];
  if (!ManagerClass)
    throw new Error("Unable to find manager class in Manager Registration.")

  const feedManager = new ManagerClass();

  const feeds = Object.values(feedManager.getFeeds(userId))

  // const targetFeeds = map(feedManager.getUserFeed, targetIds)
  const targetFeeds: UserBaseFeed[] = targetIds.map((targetId) => feedManager.getUserFeed(targetId))

  const activities = []

  console.log('here following many', targetFeeds);
  for await (const targetFeed of targetFeeds) {
    const separator = getSeparator()
    console.log('before get item', 0, follow_activity_limit);
    const feedItems = await targetFeed.getItem(0, follow_activity_limit)
    console.log('after get item', feedItems);
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
      console.log('feed', feed);
      console.log('adding many in followMany');
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
export const unfollowManyWorker = new Worker(queueNames.unfollowManyQueue, async (job: Job) => {

  const { feedManagerName, userId, targetIds: sourceIds } = job.data
  if (!feedManagerName)
    throw new Error(`Please provide feedManagerName. ${feedManagerName}`)

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

