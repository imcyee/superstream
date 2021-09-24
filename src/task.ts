// from celery import shared_task
// from stream_framework.activity import Activity, AggregatedActivity

import { Activity } from "./activity/Activity"
import { AggregatedActivity } from "./activity/AggregatedActivity"
import { Manager } from "./feed_managers/base"

/**
 * Previously, stream-framework is using celery shared_task
 * currently we don't and looking for substitute.
 */

// @shared_task
export function fanout_operation(feed_manager: Manager, FeedClass, user_ids, operation, operation_kwargs) {
  // '''
  // Simple task wrapper for _fanout task
  // Just making sure code is where you expect it :)
  // '''
  feed_manager.fanout(user_ids, FeedClass, operation, operation_kwargs)

  const format = (a, b, c, d) => { return `${a} user_ids, ${b}, ${c} ${d}` }
  return format(user_ids.length, FeedClass, operation, operation_kwargs)
}

// @shared_task
export function fanout_operation_hi_priority(feed_manager, FeedClass, user_ids, operation, operation_kwargs) {
  return fanout_operation(feed_manager, FeedClass, user_ids, operation, operation_kwargs)
}

// @shared_task
export function fanout_operation_low_priority(feed_manager: Manager, FeedClass, user_ids, operation, operation_kwargs) {
  return fanout_operation(feed_manager, FeedClass, user_ids, operation, operation_kwargs)
}

// @shared_task
export function follow_many(feed_manager: Manager, user_id, target_ids, follow_limit) {
  const feeds = Object.values(feed_manager.getFeeds(user_id))

  // const target_feeds = map(feed_manager.getUserFeed, target_ids)
  const target_feeds = target_ids.map((targetId) => feed_manager.getUserFeed(targetId))


  console.log('in follow many');
  const activities = []
  for (const target_feed of target_feeds) {
    activities.push(target_feed.getItems(0, follow_limit))
  }
  if (activities) {
    for (const feed of feeds) {

      // 🔥 re-add batch interface
      // const batch_interface = feed.getTimelineBatchInterface()
      // feed.addMany(activities, { batch_interface })
      feed.addMany(activities)
    }
  }
}

// @shared_task
export function unfollow_many(feed_manager, user_id, source_ids) {
  for (const feed of feed_manager.getFeeds(user_id).values()) {
    const activities = []
    feed.trim()
    for (const item of feed.getItems(0, feed.max_length)) {
      if (item instanceof Activity) {
        if (source_ids.includes(item.actorId))
          activities.push(item)
      } else if (item instanceof AggregatedActivity) {
        // activities.extend([activity for activity in item.activities if activity.actorId in source_ids])

        const filteredActivities = item.activities.filter((a) => source_ids.includes(a.actorId))
        activities.concat(filteredActivities)


      }
    }
    if (activities)
      feed.remove_many(activities)
  }
}