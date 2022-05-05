import type { Queue } from "bullmq"
import createDebug from 'debug'
import { chunk, overEvery } from 'lodash'
import { NotImplementedError, ValueError } from "../errors"
import { RedisFeed } from "../feeds/RedisFeed"
import { UserBaseFeed } from "../feeds/UserBaseFeed"
import { getMetricsInstance } from "../metrics/node_statsd"
import { fanoutHighPriorityQueue, fanoutLowPriorityQueue, fanoutQueue, followManyQueue, unfollowManyQueue } from "../task_registration"


const debug = createDebug('ns:debug:base')

class FanoutPriority {
  static HIGH = 'HIGH'
  static LOW = 'LOW'
}

type FanoutPriorityType = {
  [priority: string]: Queue
}

/**
 * '''
 * The Manager class handles the fanout from a user's activity
 * to all their follower's feeds
 * 
 * .. note::
 *     Fanout is the process which pushes a little bit of data to all of your
 *     followers in many small and asynchronous tasks.
 * 
 * To write your own Manager class you will need to implement
 * 
 * - getUserFollowerIds
 * - FeedClasses
 * - UserFeedClass
 * 
 * @example
 * 
 *     from stream_framework.feedManagers.base import Manager
 * 
 *     class PinManager(Manager):
 *         # customize the feed classes we write to
 *         FeedClasses = dict(
 *             normal=PinFeed,
 *             aggregated=AggregatedPinFeed
 *         )
 *         # customize the user feed class
 *         UserFeedClass = UserPinFeed
 * 
 *         # define how stream_framework can get the follower ids
 *         getUserFollowerIds(userId):
 *             ids = Follow.objects.filter(target=userId).values_list('userId', flat=true)
 *             return {FanoutPriority.HIGH:ids}
 * 
 *         # utility functions to easy integration for your project
 *         add_pin(pin):
 *             activity = pin.create_activity()
 *             # add user activity adds it to the user feed, and starts the fanout
 *             this.addUserActivity(pin.userId, activity)
 * 
 *         remove_pin(pin):
 *             activity = pin.create_activity()
 *             # removes the pin from the user's followers feeds
 *             this.removeUserActivity(pin.userId, activity)
*/
export class Manager {

  // '''
  // # : a dictionary with the feeds to fanout to
  // # : for example FeedClasses = dict(normal=PinFeed, aggregated=AggregatedPinFeed)
  get FeedClasses(): { [type: string]: any } {
    return {
      normal: RedisFeed
    }
  }

  // # : the user feed class (it stores the latest activity by one user)
  UserFeedClass = UserBaseFeed

  // # : the number of activities which enter your feed when you follow someone
  follow_activity_limit = 5000
  // # : the number of users which are handled in one asynchronous task
  // # : when doing the fanout
  fanoutChunkSize = 100

  // # maps between priority and fanout tasks
  // priorityFanoutTask: FanoutPriorityType
  priorityFanoutTask: FanoutPriorityType = {
    [FanoutPriority.HIGH]: fanoutHighPriorityQueue,
    [FanoutPriority.LOW]: fanoutLowPriorityQueue
  }
  metrics = getMetricsInstance()

  // '''
  // Returns a dict of users ids which follow the given user grouped by
  // priority/importance
  // eg.
  // {'HIGH': [...], 'LOW': [...]}
  // :param userId: the user id for which to get the follower ids
  // '''
  async getUserFollowerIds(userId): Promise<{
    [priority: string]: string[]
  }> {
    throw new NotImplementedError()
  }

  // '''
  // Store the new activity and then fanout to user followers
  // This function will
  // - store the activity in the activity storage
  // - store it in the user feed (list of activities for one user)
  // - fanout for all FeedClasses
  // :param userId: the id of the user
  // :param activity: the activity which to add
  // '''
  async addUserActivity(userId, activity) {
    // # add into the global activity cache (if we are using it)
    await this.UserFeedClass.insertActivity(activity)
    // # now add to the user's personal feed
    const userFeed = this.getUserFeed(userId)
    await userFeed.add(activity)
    const operation_kwargs = {
      activities: [activity],
      trim: true
    }

    const userFollowerIds = await this.getUserFollowerIds(userId)
    console.log('userFollowerIds', userFollowerIds);

    for await (const [priority_group, follower_ids] of Object.entries(userFollowerIds)) {
      console.log('awaiting addUserActivity', priority_group, follower_ids);
      console.log('adding to fanout queue');
      await fanoutQueue.add('addUserActivity', {
        feedManagerName: this.constructor.name,
        follower_ids,
        operationName: 'addOperation',
        operation_kwargs,
        fanout_priority: priority_group
      })
    }
    this.metrics.on_activity_published()
  }

  // '''
  // Remove the activity and then fanout to user followers
  // :param userId: the id of the user
  // :param activity: the activity which to remove
  // '''
  async removeUserActivity(userId, activity) {
    // # we don't remove from the global feed due to race conditions
    // # but we do remove from the personal feed
    const userFeed = this.getUserFeed(userId)
    await userFeed.remove(activity)

    // # no need to trim when removing items
    const operation_kwargs = {
      activities: [activity],
      trim: false
    }

    const userFollowerIds = await this.getUserFollowerIds(userId)
    for await (const [priority_group, follower_ids] of Object.entries(userFollowerIds)) {
      await fanoutQueue.add('removeUserActivity', {
        feedManagerName: this.constructor.name,
        follower_ids,
        operationName: 'removeOperation',
        operation_kwargs,
        fanout_priority: priority_group
      })
    }
    this.metrics.on_activity_removed()
  }

  // '''
  // get the feed that contains the sum of all activity
  // from feeds :userId is subscribed to
  // :returns dict: a dictionary with the feeds we're pushing to
  // '''
  getFeeds(userId): {
    [key: string]: UserBaseFeed
  } {
    console.log('get feeds', userId);
    const feeds_dict = {}
    for (const [k, Feed] of Object.entries(this.FeedClasses)) {
      feeds_dict[k] = new Feed(userId)
      // ([k, feed(userId)])
    }
    return feeds_dict
    // return dict([(k, feed(userId)) for k, feed in this.FeedClasses.items()])
  }

  // '''
  // feed where activity from :userId is saved
  // :param userId: the id of the user
  // '''
  getUserFeed(userId) {
    return new this.UserFeedClass(userId)
  }

  // '''
  // Update the user activities
  // :param activities: the activities to update
  // '''
  async updateUserActivities(activities) {
    for await (const activity of activities)
      await this.addUserActivity(activity.actorId, activity)
  }

  async updateUserActivity(activity) {
    await this.updateUserActivities([activity])
  }

  // '''
  // copies source_feed entries into feed
  // it will only copy follow_activity_limit activities
  // :param feed: the feed to copy to
  // :param source_feed: the feed with a list of activities to add
  // '''
  async followFeed(feed: UserBaseFeed, source_feed: UserBaseFeed) {
    const activities = await source_feed.getItem(0, this.follow_activity_limit)
    if (activities.length)
      return await feed.addMany(activities)
  }

  // '''
  // removes entries originating from the source feed form the feed class
  // this will remove all activities, so this could take a while
  // :param feed: the feed to copy to
  // :param source_feed: the feed with a list of activities to remove
  // '''
  async unfollowFeed(feed: UserBaseFeed, source_feed: UserBaseFeed) {
    const activities = await source_feed.getItem(0) // from 0 to end of activities need to slice
    if (activities.length) {
      const activityIds = activities.map(a => a.serializationId)
      return await feed.removeMany(activityIds, {})
    }
  }

  // '''
  // userId starts following targetUserId
  // :param userId: the user which is doing the following
  // :param targetUserId: the user which is being followed
  // :param async_: controls if the operation should be done via celery
  // '''
  async followUser(userId, targetUserId, async_ = true) {
    await this.followManyUsers(userId, [targetUserId], async_)
  }

  // '''
  // userId stops following targetUserId
  // :param userId: the user which is doing the unfollowing
  // :param targetUserId: the user which is being unfollowed
  // :param async_: controls if the operation should be done via celery
  // '''
  async unfollowUser(userId, targetUserId, async_ = true) {
    await this.unfollowManyUsers(userId, [targetUserId], async_)
  }

  // '''
  // Copies feeds' entries that belong to targetIds into the
  // corresponding feeds of userId.
  // :param userId: the user which is doing the following
  // :param targetIds: the users to follow
  // :param async_: controls if the operation should be done via celery
  // '''
  async followManyUsers(userId, targetIds, async_ = true) {
    await followManyQueue.add('followManyUsers', {
      feedManagerName: this.constructor.name,
      userId,
      targetIds,
      follow_activity_limit: this.follow_activity_limit
    })
  }

  // '''
  // Removes feeds' entries that belong to targetIds from the
  // corresponding feeds of userId.
  // :param userId: the user which is doing the unfollowing
  // :param targetIds: the users to unfollow
  // :param async_: controls if the operation should be done via celery
  // '''
  async unfollowManyUsers(userId, targetIds, async_ = true) {
    await unfollowManyQueue.add('unfollowManyUsers', {
      feedManagerName: this.constructor.name,
      userId,
      targetIds,
    })
  }

  // '''
  // Returns the fanout task taking priority in account.
  // :param priority: the priority of the task
  // :param FeedClass: the FeedClass the task will write to
  // '''
  getFanoutTask(priority = null): Queue {
    return this.priorityFanoutTask[priority] || fanoutQueue
  }

  // '''
  // This functionality is called from within stream_framework.tasks.fanout_operation
  // :param userIds: the list of user ids which feeds we should apply the
  //     operation against
  // :param FeedClass: the feed to run the operation on
  // :param operation: the operation to run on the feed
  // :param operation_kwargs: kwargs to pass to the operation
  // '''
  async fanout(userIds, FeedClass, operation, operation_kwargs) {

    console.log('fanning out', operation_kwargs);
    const timer = this.metrics.fanoutTimer(FeedClass)
    timer.start()
    try {
      const separator = '==='.repeat(10)
      // logger.info('${} starting fanout ${}', separator, separator)
      const batch_context_manager = FeedClass.getTimelineBatchInterface()
      const msg_format = 'starting batch interface for feed ${}, fanning out to ${} users'
      const batchInterface = batch_context_manager
      // logger.info(msg_format, FeedClass, len(userIds))
      operation_kwargs['batchInterface'] = batchInterface
      for (const userId of userIds) {
        debug(`now handling fanout to user ${userId}`)
        const feed = new FeedClass(userId)
        // operation(feed, ...operation_kwargs) 
        // 🔥 do we wait for fanout??
        await operation(feed, operation_kwargs)
      }
    } finally {
      timer.stop()
    }

    // logger.info('finished fanout for feed ${}', FeedClass)}
    const fanout_count = operation_kwargs['activities'].length * (userIds).length
    this.metrics.on_fanout(FeedClass, operation, fanout_count)
  }

  /** 
  * Batch import all of the users activities and distributes
  * them to the users followers
  * @example
  *     activities = [long list of activities]
  *     stream_framework.batchImport(13, activities, 500)
  * :param userId: the user who created the activities
  * :param activities: a list of activities from this user
  * :param fanout: if we should run the fanout or not
  * :param chunk_size: per how many activities to run the batch operations 
  */
  batchImport(userId, activities, fanout = true, chunk_size = 500) {
    // activities = list(activities)
    // # skip empty lists
    if (!activities)
      return
    // logger.info('running batch import for user ${}', userId)

    const userFeed = this.getUserFeed(userId)
    if (activities[0].actorId != userId)
      throw new ValueError('Send activities for only one user please')

    // const activityChunks = list(chunks(activities, chunk_size))
    const activityChunks = chunk(activities, chunk_size)

    // logger.info('processing ${} items in ${} chunks of ${}',
    //             len(activities), len(activityChunks), chunk_size)

    // for (index, activityChunk in enumerate(activityChunks)) {
    for (const [index, activityChunk] of activityChunks.entries()) {
      // # first insert into the global activity storage
      this.UserFeedClass.insertActivities(activityChunk)
      // logger.info(
      //     'inserted chunk ${} (length ${}) into the global activity store', index, len(activityChunk))
      // # next add the activities to the users personal timeline
      userFeed.addMany(activityChunk, { trim: false })
      // logger.info( 'inserted chunk ${} (length ${}) into the user feed', index, len(activityChunk))
      // # now start a big fanout task
      if (fanout) {
        // logger.info('starting task fanout for chunk ${}', index)
        const follower_ids_by_prio = this.getUserFollowerIds(userId = userId)
        // # create the fanout tasks
        const operation_kwargs = {
          activities: activityChunk,
          trim: false
        }
        for (const [priority_group, fids] of Object.entries(follower_ids_by_prio)) {
          fanoutQueue.add('batchImport', {
            feedManagerName: this.constructor.name,
            follower_ids: fids,
            operationName: 'addOperation',
            operation_kwargs,
            fanout_priority: priority_group
          })
        }
      }
    }
  }
}

