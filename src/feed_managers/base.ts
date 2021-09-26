import { NotImplementedError, ValueError } from "../errors"
import { BaseFeed } from "../feeds/base/base"
import { RedisFeed } from "../feeds/RedisFeed"
import { fanout_operation, fanoutOperationHiPriority, fanoutOperationLowPriority, follow_many, unfollow_many } from "../task"
import { chunk } from 'lodash'
import { UserBaseFeed } from "../feeds/UserBaseFeed"
import createDebug from 'debug'
import SDC from 'statsd-client'

const sdc = new SDC({ host: 'localhost', });

const debug = createDebug('ns:debug:base')
 

async function add_operation(feed, {
  activities,
  trim = true,
  batchInterface = null
}) {
  // '''
  // Add the activities to the feed
  // functions used in tasks need to be at the main level of the module
  // '''
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
async function removeOperation(feed, {
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

class FanoutPriority {
  static HIGH = 'HIGH'
  static LOW = 'LOW'
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
 *     from stream_framework.feed_managers.base import Manager
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
  FeedClasses = {
    normal: RedisFeed
  }
  // # : the user feed class (it stores the latest activity by one user)
  UserFeedClass = UserBaseFeed

  // # : the number of activities which enter your feed when you follow someone
  follow_activity_limit = 5000
  // # : the number of users which are handled in one asynchronous task
  // # : when doing the fanout
  fanout_chunk_size = 100

  // # maps between priority and fanout tasks
  priority_fanout_task = {
    [FanoutPriority.HIGH]: fanoutOperationHiPriority,
    [FanoutPriority.LOW]: fanoutOperationLowPriority
  }

  // metrics = get_metrics_instance()


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
    for await (const [priority_group, follower_ids] of Object.entries(userFollowerIds)) {
      // # create the fanout tasks
      for await (const FeedClass of Object.values(this.FeedClasses)) {
        await this.createFanoutTasks(
          follower_ids,
          FeedClass,
          add_operation,
          operation_kwargs,
          priority_group
        )
      }
    }
    // this.metrics.on_activity_published()
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
    for (const [priority_group, follower_ids] of Object.entries(userFollowerIds)) {
      for (const FeedClass of Object.values(this.FeedClasses)) {
        this.createFanoutTasks(
          follower_ids,
          FeedClass,
          removeOperation,
          operation_kwargs,
          priority_group
        )
      }
    }
    // this.metrics.on_activity_removed()
  }

  // '''
  // get the feed that contains the sum of all activity
  // from feeds :userId is subscribed to

  // :returns dict: a dictionary with the feeds we're pushing to
  // '''
  getFeeds(userId): {
    [key: string]: BaseFeed
  } {
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
  updateUserActivities(activities) {
    for (const activity of activities)
      this.addUserActivity(activity.actorId, activity)
  }

  updateUserActivity(activity) {
    this.updateUserActivities([activity])
  }

  // '''
  // copies source_feed entries into feed
  // it will only copy follow_activity_limit activities

  // :param feed: the feed to copy to
  // :param source_feed: the feed with a list of activities to add
  // '''
  async followFeed(feed: BaseFeed, source_feed: BaseFeed) {
    const activities = source_feed.getItem(0, this.follow_activity_limit)
    if (activities)
      return await feed.addMany(activities)
  }

  // '''
  // removes entries originating from the source feed form the feed class
  // this will remove all activities, so this could take a while
  // :param feed: the feed to copy to
  // :param source_feed: the feed with a list of activities to remove
  // '''
  unfollowFeed(feed, source_feed: BaseFeed) {
    const activities = source_feed.getItem(0) // need to slice
    if (activities)
      return feed.removeMany(activities)
  }

  // '''
  // userId starts following target_user_id

  // :param userId: the user which is doing the following
  // :param target_user_id: the user which is being followed
  // :param async_: controls if the operation should be done via celery
  // '''
  followUser(userId, target_user_id, async_ = true) {
    this.followManyUsers(userId, [target_user_id], async_)
  }

  // '''
  // userId stops following target_user_id

  // :param userId: the user which is doing the unfollowing
  // :param target_user_id: the user which is being unfollowed
  // :param async_: controls if the operation should be done via celery
  // '''
  unfollowUser(userId, target_user_id, async_ = true) {
    this.unfollowManyUsers(userId, [target_user_id], async_)
  }

  // '''
  // Copies feeds' entries that belong to target_ids into the
  // corresponding feeds of userId.

  // :param userId: the user which is doing the following
  // :param target_ids: the users to follow
  // :param async_: controls if the operation should be done via celery
  // '''
  followManyUsers(userId, target_ids, async_ = true) {
    var follow_many_fn
    // if (async_)
    //   follow_many_fn = follow_many.delay // delay is celery shared_task
    // else
    //   follow_many_fn = follow_many

    follow_many_fn = follow_many

    follow_many_fn(
      userId,
      target_ids,
      this.follow_activity_limit
    )
  }

  // '''
  // Removes feeds' entries that belong to target_ids from the
  // corresponding feeds of userId.

  // :param userId: the user which is doing the unfollowing
  // :param target_ids: the users to unfollow
  // :param async_: controls if the operation should be done via celery
  // '''
  unfollowManyUsers(userId, target_ids, async_ = true) {
    var unfollow_many_fn
    // if (async_)
    //   unfollow_many_fn = unfollow_many.delay // delay is celery shared_task
    // else
    //   unfollow_many_fn = unfollow_many

    unfollow_many_fn = unfollow_many
    unfollow_many_fn(userId, target_ids)
  }

  // '''
  // Returns the fanout task taking priority in account.

  // :param priority: the priority of the task
  // :param FeedClass: the FeedClass the task will write to
  // '''
  getFanoutTask(priority = null, FeedClass = null) {
    const prioriyFanoutTask = this.priority_fanout_task[priority] || fanout_operation
    return prioriyFanoutTask
    // return this.priority_fanout_task.get(priority, fanout_operation)
  }

  // '''
  // Creates the fanout task for the given activities and feed classes
  // followers

  // It takes the following ids and distributes them per fanout_chunk_size
  // into smaller tasks

  // :param follower_ids: specify the list of followers
  // :param FeedClass: the feed classes to run the operation on
  // :param operation: the operation function applied to all follower feeds
  // :param operation_kwargs: kwargs passed to the operation
  // :param fanout_priority: the priority set to this fanout
  // '''
  async createFanoutTasks(follower_ids, FeedClass, operation, operation_kwargs = null, fanout_priority = null) {
    const fanoutTask = this.getFanoutTask(fanout_priority, FeedClass)
    if (!fanoutTask)
      return []
    const chunk_size = this.fanout_chunk_size
    // const user_ids_chunks = list(chunks(follower_ids, chunk_size))
    const user_ids_chunks = chunk(follower_ids, chunk_size)
    const msg_format = 'spawning ${} subtasks for ${} user ids in chunks of ${} users'
    // logger.info(
    //     msg_format, len(user_ids_chunks), len(follower_ids), chunk_size)
    var tasks = []
    // # now actually create the tasks
    for await (const ids_chunk of user_ids_chunks) {

      const task = await fanoutTask(
        this,
        FeedClass,
        ids_chunk,
        operation,
        operation_kwargs
      )
      // const task = fanoutTask.delay(
      //   feed_manager = this,
      //   FeedClass = FeedClass,
      //   user_ids = ids_chunk,
      //   operation = operation,
      //   operation_kwargs = operation_kwargs
      // )
      tasks.push(task)
    }
    return tasks
  }

  // '''
  // This functionality is called from within stream_framework.tasks.fanout_operation

  // :param user_ids: the list of user ids which feeds we should apply the
  //     operation against
  // :param FeedClass: the feed to run the operation on
  // :param operation: the operation to run on the feed
  // :param operation_kwargs: kwargs to pass to the operation

  // '''
  async fanout(user_ids, FeedClass, operation, operation_kwargs) {
    // this.metrics.fanout_timer(FeedClass)

    const separator = '==='.repeat(10)
    // logger.info('${} starting fanout ${}', separator, separator)
    const batch_context_manager = FeedClass.getTimelineBatchInterface()
    const msg_format = 'starting batch interface for feed ${}, fanning out to ${} users'
    const batchInterface = batch_context_manager
    // logger.info(msg_format, FeedClass, len(user_ids))
    operation_kwargs['batchInterface'] = batchInterface
    for (const userId of user_ids) {
      debug(`now handling fanout to user ${userId}`)
      const feed = new FeedClass(userId)
      // operation(feed, ...operation_kwargs)


      // 🔥 do we wait for fanout??
      await operation(feed, operation_kwargs)
    }

    // logger.info('finished fanout for feed ${}', FeedClass)}
    const fanout_count = operation_kwargs['activities'].length * (user_ids).length
    // this.metrics.on_fanout(FeedClass, operation, fanout_count)

  }

  // '''
  // Batch import all of the users activities and distributes
  // them to the users followers
  // **Example**::
  //     activities = [long list of activities]
  //     stream_framework.batchImport(13, activities, 500)
  // :param userId: the user who created the activities
  // :param activities: a list of activities from this user
  // :param fanout: if we should run the fanout or not
  // :param chunk_size: per how many activities to run the batch operations
  // '''
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
        for (const FeedClass of Object.values(this.FeedClasses)) {
          for (const [priority_group, fids] of Object.entries(follower_ids_by_prio)) {
            this.createFanoutTasks(
              fids,
              FeedClass,
              add_operation,
              priority_group,
              operation_kwargs
            )
          }
        }
      }
    }
  }
}

