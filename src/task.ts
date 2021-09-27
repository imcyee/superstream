// from celery import shared_task
// from stream_framework.activity import Activity, AggregatedActivity

import { Activity } from "./activity/Activity"
import { AggregatedActivity } from "./activity/AggregatedActivity"
import { BaseFeed } from "./feeds/base/base"
import { UserBaseFeed } from "./feeds/UserBaseFeed"
import { Manager } from "./feed_managers/base"

/**
 * Previously, stream-framework is using celery shared_task
 * currently we don't and looking for substitute.
 */

// @shared_task
export function fanout_operation(feedManager: Manager, FeedClass, user_ids, operation, operation_kwargs) {
  // '''
  // Simple task wrapper for _fanout task
  // Just making sure code is where you expect it :)
  // '''
  feedManager.fanout(user_ids, FeedClass, operation, operation_kwargs)

  const format = (a, b, c, d) => { return `${a} user_ids, ${b}, ${c} ${d}` }
  return format(user_ids.length, FeedClass, operation, operation_kwargs)
}

// @shared_task
export function fanoutOperationHiPriority(feedManager, FeedClass, user_ids, operation, operation_kwargs) {
  return fanout_operation(feedManager, FeedClass, user_ids, operation, operation_kwargs)
}

// @shared_task
export function fanoutOperationLowPriority(feedManager: Manager, FeedClass, user_ids, operation, operation_kwargs) {
  return fanout_operation(feedManager, FeedClass, user_ids, operation, operation_kwargs)
}

/**
 * 🔥 There is a issue here with follow many 
 * Whatever activity is in user feed is also in follower feed.
 * Include feed that is follow by others
 * @param feedManager 
 * @param user_id 
 * @param target_ids 
 * @param follow_limit 
 */
// @shared_task
export async function followMany(feedManager: Manager, user_id, target_ids, follow_limit) {
  const feeds = Object.values(feedManager.getFeeds(user_id))

  // const targetFeeds = map(feedManager.getUserFeed, target_ids)
  const targetFeeds: UserBaseFeed[] = target_ids.map((targetId) => feedManager.getUserFeed(targetId))

  const activities = []
  for await (const targetFeed of targetFeeds) {
    const feedItems = await targetFeed.getItem(0, follow_limit)
    activities.push(...feedItems)
  }
  if (activities) {
    for await (const feed of feeds) {
      // 🔥 re-add batch interface
      // const batch_interface = feed.getTimelineBatchInterface()
      // feed.addMany(activities, { batch_interface })
      await feed.addMany(activities)
    }
  }
}

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
 * @param user_id 
 * @param source_ids 
 */
export async function unfollowMany(feedManager, user_id, source_ids) {
  const feeds: BaseFeed[] = Object.values(feedManager.getFeeds(user_id))
  for (const feed of feeds) {
    const activities = []
    await feed.trim()
    const items = await feed.getItem(0, feed.maxLength)
    for (const item of items) {
      if (item instanceof Activity) {
        if (source_ids.includes(item.actorId))
          activities.push(item)
      } else if (item instanceof AggregatedActivity) {
        // activities.extend([activity for activity in item.activities if activity.actorId in source_ids])
        const filteredActivities = item.activities.filter((a) => source_ids.includes(a.actorId))
        activities.push(...filteredActivities)
      }
    }
    if (activities)
      await feed.removeMany(activities, {})
  }
}