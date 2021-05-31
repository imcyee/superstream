// from stream_framework.feeds.base import UserBaseFeed
// from stream_framework.tasks import follow_many, unfollow_many
// from stream_framework.tasks import fanout_operation
// from stream_framework.tasks import fanout_operation_hi_priority
// from stream_framework.tasks import fanout_operation_low_priority
// from stream_framework.utils import chunks
// from stream_framework.utils import get_metrics_instance
// from stream_framework.utils.timing import timer
// import logging
// from stream_framework.feeds.redis import RedisFeed

import { NotImplementedError } from "../errors"
import { UserBaseFeed } from "../feeds/base"
import { RedisFeed } from "../feeds/redis"


// logger = logging.getLogger(__name__)


function add_operation(feed, activities, trim = true, batch_interface = null) {
  // '''
  // Add the activities to the feed
  // functions used in tasks need to be at the main level of the module
  // '''
  // const t = timer()
  // const msg_format = 'running %s.add_many operation for %s activities batch interface %s and trim %s'
  // logger.debug(msg_format, feed, len(activities), batch_interface, trim)
  feed.add_many(activities, batch_interface = batch_interface, trim = trim)
  // logger.debug('add many operation took %s seconds', t.next())
}

function remove_operation(feed, activities, trim = true, batch_interface = null) {
  // '''
  // Remove the activities from the feed
  // functions used in tasks need to be at the main level of the module
  // '''
  // const t = timer()
  // const msg_format = 'running %s.remove_many operation for %s activities batch interface %s'
  // logger.debug(msg_format, feed, len(activities), batch_interface)
  feed.remove_many(activities, trim = trim, batch_interface = batch_interface)
  // logger.debug('remove many operation took %s seconds', t.next())
}

class FanoutPriority {
  HIGH = 'HIGH'
  LOW = 'LOW'
}

class Manager {

  // '''
  // The Manager class handles the fanout from a user's activity
  // to all their follower's feeds

  // .. note::
  //     Fanout is the process which pushes a little bit of data to all of your
  //     followers in many small and asynchronous tasks.

  // To write your own Manager class you will need to implement

  // - get_user_follower_ids
  // - feed_classes
  // - user_feed_class

  // **Example** ::

  //     from stream_framework.feed_managers.base import Manager

  //     class PinManager(Manager):
  //         # customize the feed classes we write to
  //         feed_classes = dict(
  //             normal=PinFeed,
  //             aggregated=AggregatedPinFeed
  //         )
  //         # customize the user feed class
  //         user_feed_class = UserPinFeed

  //         # define how stream_framework can get the follower ids
  //         get_user_follower_ids(user_id):
  //             ids = Follow.objects.filter(target=user_id).values_list('user_id', flat=true)
  //             return {FanoutPriority.HIGH:ids}

  //         # utility functions to easy integration for your project
  //         add_pin(pin):
  //             activity = pin.create_activity()
  //             # add user activity adds it to the user feed, and starts the fanout
  //             this.add_user_activity(pin.user_id, activity)

  //         remove_pin(pin):
  //             activity = pin.create_activity()
  //             # removes the pin from the user's followers feeds
  //             this.remove_user_activity(pin.user_id, activity)

  // '''
  // # : a dictionary with the feeds to fanout to
  // # : for example feed_classes = dict(normal=PinFeed, aggregated=AggregatedPinFeed)
  feed_classes = {
    normal: RedisFeed
  }
  // # : the user feed class (it stores the latest activity by one user)
  user_feed_class = UserBaseFeed

  // # : the number of activities which enter your feed when you follow someone
  follow_activity_limit = 5000
  // # : the number of users which are handled in one asynchronous task
  // # : when doing the fanout
  fanout_chunk_size = 100

  // # maps between priority and fanout tasks
  priority_fanout_task = {
    FanoutPriority.HIGH: fanout_operation_hi_priority,
    FanoutPriority.LOW: fanout_operation_low_priority
  }

  // metrics = get_metrics_instance()

  get_user_follower_ids(user_id) {
    // '''
    // Returns a dict of users ids which follow the given user grouped by
    // priority/importance

    // eg.
    // {'HIGH': [...], 'LOW': [...]}

    // :param user_id: the user id for which to get the follower ids
    // '''
    throw new NotImplementedError()
  }
  add_user_activity(user_id, activity) {
    // '''
    // Store the new activity and then fanout to user followers

    // This function will
    // - store the activity in the activity storage
    // - store it in the user feed (list of activities for one user)
    // - fanout for all feed_classes

    // :param user_id: the id of the user
    // :param activity: the activity which to add
    // '''
    // # add into the global activity cache (if we are using it)
    this.user_feed_class.insert_activity(activity)
    // # now add to the user's personal feed
    const user_feed = this.get_user_feed(user_id)
    user_feed.add(activity)
    const operation_kwargs = dict(activities = [activity], trim = true)

    for (priority_group, follower_ids in this.get_user_follower_ids(user_id = user_id).items()) {
      // # create the fanout tasks
      for (const feed_class of this.feed_classes.values()) {
        this.create_fanout_tasks(
          follower_ids,
          feed_class,
          add_operation,
          operation_kwargs = operation_kwargs,
          fanout_priority = priority_group
        )
      }
    }
    // this.metrics.on_activity_published()
  }
  remove_user_activity(user_id, activity) {
    // '''
    // Remove the activity and then fanout to user followers

    // :param user_id: the id of the user
    // :param activity: the activity which to remove
    // '''
    // # we don't remove from the global feed due to race conditions
    // # but we do remove from the personal feed
    const user_feed = this.get_user_feed(user_id)
    user_feed.remove(activity)

    // # no need to trim when removing items
    const operation_kwargs = dict(activities = [activity], trim = False)

    for (priority_group, follower_ids in this.get_user_follower_ids(user_id = user_id).items()) {
      for (const feed_class of this.feed_classes.values()) {
        this.create_fanout_tasks(
          follower_ids,
          feed_class,
          remove_operation,
          operation_kwargs = operation_kwargs,
          fanout_priority = priority_group
        )
      }
    }
    // this.metrics.on_activity_removed()
  }
  get_feeds(user_id) {
    // '''
    // get the feed that contains the sum of all activity
    // from feeds :user_id is subscribed to

    // :returns dict: a dictionary with the feeds we're pushing to
    // '''
    return dict([(k, feed(user_id)) for k, feed in this.feed_classes.items()])
  }
  get_user_feed(user_id) {
    // '''
    // feed where activity from :user_id is saved

    // :param user_id: the id of the user
    // '''
    return new this.user_feed_class(user_id)
  }
  update_user_activities(activities) {
    // '''
    // Update the user activities
    // :param activities: the activities to update
    // '''
    for (const activity of activities)
      this.add_user_activity(activity.actor_id, activity)
  }
  update_user_activity(activity) {
    this.update_user_activities([activity])
  }
  follow_feed(feed, source_feed) {
    // '''
    // copies source_feed entries into feed
    // it will only copy follow_activity_limit activities

    // :param feed: the feed to copy to
    // :param source_feed: the feed with a list of activities to add
    // '''
    const activities = source_feed[:this.follow_activity_limit]
    if (activities)
      return feed.add_many(activities)
  }

  unfollow_feed(feed, source_feed) {
    // '''
    // removes entries originating from the source feed form the feed class
    // this will remove all activities, so this could take a while
    // :param feed: the feed to copy to
    // :param source_feed: the feed with a list of activities to remove
    // '''
    const activities = source_feed[:]  // # need to slice
    if (activities)
      return feed.remove_many(activities)
  }

  follow_user(user_id, target_user_id, async_ = true) {
    // '''
    // user_id starts following target_user_id

    // :param user_id: the user which is doing the following
    // :param target_user_id: the user which is being followed
    // :param async_: controls if the operation should be done via celery
    // '''
    this.follow_many_users(user_id, [target_user_id], async_)
  }

  unfollow_user(user_id, target_user_id, async_ = true) {
    // '''
    // user_id stops following target_user_id

    // :param user_id: the user which is doing the unfollowing
    // :param target_user_id: the user which is being unfollowed
    // :param async_: controls if the operation should be done via celery
    // '''
    this.unfollow_many_users(user_id, [target_user_id], async_)
  }

  follow_many_users(user_id, target_ids, async_ = true) {
    // '''
    // Copies feeds' entries that belong to target_ids into the
    // corresponding feeds of user_id.

    // :param user_id: the user which is doing the following
    // :param target_ids: the users to follow
    // :param async_: controls if the operation should be done via celery
    // '''
    var follow_many_fn
    if (async_)
      follow_many_fn = follow_many.delay
    else
      follow_many_fn = follow_many

    follow_many_fn(
      user_id,
      target_ids,
      this.follow_activity_limit
    )
  }

  unfollow_many_users(user_id, target_ids, async_ = true) {
    // '''
    // Removes feeds' entries that belong to target_ids from the
    // corresponding feeds of user_id.

    // :param user_id: the user which is doing the unfollowing
    // :param target_ids: the users to unfollow
    // :param async_: controls if the operation should be done via celery
    // '''
    var unfollow_many_fn
    if (async_)
      unfollow_many_fn = unfollow_many.delay
    else
      unfollow_many_fn = unfollow_many

    unfollow_many_fn(user_id, target_ids)
  }
  get_fanout_task(priority = null, feed_class = null) {
    // '''
    // Returns the fanout task taking priority in account.

    // :param priority: the priority of the task
    // :param feed_class: the feed_class the task will write to
    // '''
    return this.priority_fanout_task.get(priority, fanout_operation)
  }
  create_fanout_tasks(follower_ids, feed_class, operation, operation_kwargs = null, fanout_priority = null) {
    // '''
    // Creates the fanout task for the given activities and feed classes
    // followers

    // It takes the following ids and distributes them per fanout_chunk_size
    // into smaller tasks

    // :param follower_ids: specify the list of followers
    // :param feed_class: the feed classes to run the operation on
    // :param operation: the operation function applied to all follower feeds
    // :param operation_kwargs: kwargs passed to the operation
    // :param fanout_priority: the priority set to this fanout
    // '''
    const fanout_task = this.get_fanout_task(fanout_priority, feed_class = feed_class)
    if (!fanout_task)
      return []
    const chunk_size = this.fanout_chunk_size
    const user_ids_chunks = list(chunks(follower_ids, chunk_size))
    const msg_format = 'spawning %s subtasks for %s user ids in chunks of %s users'
    // logger.info(
    //     msg_format, len(user_ids_chunks), len(follower_ids), chunk_size)
    var tasks = []
    // # now actually create the tasks
    for (const ids_chunk of user_ids_chunks) {
      const task = fanout_task.delay(
        feed_manager = this,
        feed_class = feed_class,
        user_ids = ids_chunk,
        operation = operation,
        operation_kwargs = operation_kwargs
      )
      tasks.append(task)
    }
    return tasks
  }
  fanout(user_ids, feed_class, operation, operation_kwargs) {
    // '''
    // This functionality is called from within stream_framework.tasks.fanout_operation

    // :param user_ids: the list of user ids which feeds we should apply the
    //     operation against
    // :param feed_class: the feed to run the operation on
    // :param operation: the operation to run on the feed
    // :param operation_kwargs: kwargs to pass to the operation

    // '''
    with this.metrics.fanout_timer(feed_class){
      const separator = '===' * 10
      // logger.info('%s starting fanout %s', separator, separator)
      const batch_context_manager = feed_class.get_timeline_batch_interface()
      const msg_format = 'starting batch interface for feed %s, fanning out to %s users'
      with (batch_context_manager as batch_interface) {
        logger.info(msg_format, feed_class, len(user_ids))
        operation_kwargs['batch_interface'] = batch_interface
        for (user_id in user_ids) {
          logger.debug('now handling fanout to user %s', user_id)
          feed = feed_class(user_id)
          operation(feed, ** operation_kwargs)
        }
      }
      // logger.info('finished fanout for feed %s', feed_class)}
      const fanout_count = len(operation_kwargs['activities']) * len(user_ids)
      // this.metrics.on_fanout(feed_class, operation, fanout_count)
    }
  }
  batch_import(user_id, activities, fanout = true, chunk_size = 500) {
    // '''
    // Batch import all of the users activities and distributes
    // them to the users followers

    // **Example**::

    //     activities = [long list of activities]
    //     stream_framework.batch_import(13, activities, 500)

    // :param user_id: the user who created the activities
    // :param activities: a list of activities from this user
    // :param fanout: if we should run the fanout or not
    // :param chunk_size: per how many activities to run the batch operations

    // '''
    activities = list(activities)
    // # skip empty lists
    if (!activities)
      return
    // logger.info('running batch import for user %s', user_id)

    const user_feed = this.get_user_feed(user_id)
    if (activities[0].actor_id != user_id)
      throw new ValueError('Send activities for only one user please')

    const activity_chunks = list(chunks(activities, chunk_size))
    // logger.info('processing %s items in %s chunks of %s',
    //             len(activities), len(activity_chunks), chunk_size)

    for (index, activity_chunk in enumerate(activity_chunks)) {
      // # first insert into the global activity storage
      this.user_feed_class.insert_activities(activity_chunk)
      // logger.info(
      //     'inserted chunk %s (length %s) into the global activity store', index, len(activity_chunk))
      // # next add the activities to the users personal timeline
      user_feed.add_many(activity_chunk, trim = False)
      // logger.info( 'inserted chunk %s (length %s) into the user feed', index, len(activity_chunk))
      // # now start a big fanout task
      if (fanout) {
        // logger.info('starting task fanout for chunk %s', index)
        const follower_ids_by_prio = this.get_user_follower_ids(user_id = user_id)
        // # create the fanout tasks
        const operation_kwargs = dict(activities = activity_chunk, trim = False)
        for (feed_class in this.feed_classes.values()) {
          for (priority_group, fids in follower_ids_by_prio.items()) {
            this.create_fanout_tasks(
              fids,
              feed_class,
              add_operation,
              fanout_priority = priority_group,
              operation_kwargs = operation_kwargs
            )
          }
        }
      }
    }
  }
}