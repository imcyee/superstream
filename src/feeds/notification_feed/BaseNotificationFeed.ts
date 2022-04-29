// from stream_framework.activity import NotificationActivity
// from stream_framework.aggregators.base import NotificationAggregator
// from stream_framework.feeds.aggregated_feed.base import AggregatedFeed
// from stream_framework.serializers.aggregated_activity_serializer import NotificationSerializer
// from stream_framework.storage.base_lists_storage import BaseListsStorage

import { NotificationActivity } from "../../activity/NotificationActivity"
import { NotificationAggregator } from "../../aggregators/base"
import { ValueError } from "../../errors"
import { NotificationSerializer } from "../../serializers/AggregatedActivitySerializer"
import { BaseListsStorage } from "../../storage/base/base_lists_storage"
import { RedisListsStorage } from "../../storage/redis/RedisListsStorage"
import { AggregatedFeed } from "../aggregated_feed/AggregatedFeed"

// import logging
// logger = logging.getLogger(__name__)


// '''
// Similar to an aggregated feed, but:
// - does not use the activity storage (serializes everything into the timeline storage)
// - tracks unseen/unread aggregated activities
// - enables counting of unseen/unread aggregated activities
// - enables marking of unseen/unread aggregated activities as seen/read
// '''
export abstract class BaseNotificationFeed extends AggregatedFeed {

  keyFormat = (userId) => `notification_feed:${userId}`

  static TimelineSerializer = NotificationSerializer
  AggregatorClass = NotificationAggregator
  static AggregatedActivityClass = NotificationActivity
  static ActivityStorageClass = null
  ActivitySerializer = null

  // # : the storage class responsible to keep track of unseen/unread activity ids
  get MarkersStorageClass() { return BaseListsStorage }
  // MarkersStorageClass = RedisListsStorage

  // # : define whether or not to keep track of unseen activity ids
  track_unseen = true
  // # : define whether or not to keep track of unread activity ids
  track_unread = true

  // # : the max number of tracked unseen/unread activity ids
  markersMaxLength = 100

  // # : provides a part of the key used by MarkersStorageClass
  markersKeyFormat = (userId) => `notification_feed:${userId}`

  // #: the key used for distributed locking
  lock_format = (userId) => `notification_feed:${userId}:lock`

  feedMarkers: BaseListsStorage

  constructor(userId) {
    super(userId)

    if (!this.MarkersStorageClass) {
      if (this.track_unread || this.track_unseen)
        throw new ValueError('MarkersStorageClass must be set in case the unseen/unread activities are tracked')
    } else {
      if (!(this.MarkersStorageClass.prototype instanceof BaseListsStorage || this.MarkersStorageClass === BaseListsStorage)) {
        const error_format = (base, sub) => `MarkersStorageClass attribute must be subclass of ${base}, encountered class ${sub}`
        const message = error_format(BaseListsStorage, this.MarkersStorageClass)
        throw new ValueError(message)
      }
      const markers_key = this.markersKeyFormat(userId)

      // @ts-ignore
      this.feedMarkers = new this.MarkersStorageClass(
        markers_key,
        this.markersMaxLength
      )
    }
  }

  // '''
  // Counts the number of aggregated activities which are unseen.
  // '''
  count_unseen() {
    if (this.track_unseen)
      return this.feedMarkers.count('unseen')
  }

  // '''
  // Counts the number of aggregated activities which are unread.
  // '''
  count_unread() {
    if (this.track_unread)
      return this.feedMarkers.count('unread')
  }

  // '''
  // Provides custom notification data that is used by the transport layer
  // when the feed is updated.
  // '''
  get_notification_data() {
    const notification_data = {}

    if (this.track_unseen && this.track_unread) {
      const [unseen_count, unread_count] = this.feedMarkers.count('unseen', 'unread')
      notification_data['unseen_count'] = unseen_count
      notification_data['unread_count'] = unread_count
    } else if (this.track_unseen) {
      const [unseen_count] = this.feedMarkers.count('unseen')
      notification_data['unseen_count'] = unseen_count
    } else if (this.track_unread) {
      const [unread_count] = this.feedMarkers.count('unread')
      notification_data['unread_count'] = unread_count
    }
    return notification_data
  }

  // '''
  // Starts or stops tracking aggregated activities as unseen and/or unread.
  // '''
  update_markers(unseen_ids = null, unread_ids = null, operation = 'add') {
    if (this.MarkersStorageClass) {
      if (!['add', 'remove'].includes(operation))
        throw new TypeError(`${operation} is not supported`)

      const kwargs = {}
      if (unseen_ids && this.track_unseen)
        kwargs['unseen'] = unseen_ids
      if (unread_ids && this.track_unread)
        kwargs['unread'] = unread_ids

      // const func = getattr(this.feedMarkers, operation) 
      const func = this.feedMarkers[operation]
      func.apply(this, kwargs)
    }
    // # TODO use a real-time transport layer to notify for these updates}
  }

  // '''
  // Retrieves a slice of aggregated activities and annotates them as read and/or seen.
  // '''
  async getActivitySlice(start = null, stop = null, rehydrate = true) {
    let activities = await super.getActivitySlice(start, stop, rehydrate)
    if (activities && this.MarkersStorageClass) {
      let unseen_ids: string[]
      let unread_ids: string[]

      if (this.track_unseen && this.track_unread) {
        [unseen_ids, unread_ids] = await this.feedMarkers.get('unseen', 'unread')
      } else if (this.track_unseen)
        [unseen_ids] = await this.feedMarkers.get('unseen')
      else if (this.track_unread)
        [unread_ids] = await this.feedMarkers.get('unread')

      for (const activity of activities) {
        if (this.track_unseen)
          activity.is_seen = !unseen_ids.includes(activity.serializationId)
        if (this.track_unread)
          activity.is_read = !unseen_ids.includes(activity.serializationId)
      }
    }
    return activities
  }


  // '''
  // Adds the activities to the notification feed and marks them as unread/unseen.
  // '''
  async addManyAggregated(aggregated, kwargs?) {
    await super.addManyAggregated(aggregated, kwargs)

    // const ids = [a.serializationId for a in aggregated]
    // const ids = [a.serializationId for a in aggregated]
    const ids = aggregated.map(a => a.serializationId)
    this.update_markers(ids, ids, 'add')
  }


  // '''
  // Removes the activities from the notification feed and marks them as read/seen.
  // '''
  async removeManyAggregated(aggregated, kwargs) {
    await super.removeManyAggregated(aggregated, kwargs)
    // const ids = [a.serializationId for a in aggregated]
    const ids = aggregated.map(a => a.serializationId)
    this.update_markers(ids, ids, 'remove')
  }


  // '''
  // Marks the given aggregated activity as seen or read or both.
  // '''
  async mark_activity(activityId, seen = true, read = false) {
    await this.mark_activities([activityId], seen, read)
  }


  // '''
  // Marks all of the given aggregated activities as seen or read or both.
  // '''
  async mark_activities(activityIds, seen = true, read = false) {
    const unseen_ids = seen ? activityIds : []
    const unread_ids = read ? activityIds : []
    await this.update_markers(
      unseen_ids,
      unread_ids,
      'remove'
    )
  }


  // '''
  // Marks all of the feed's aggregated activities as seen or read or both.
  // '''
  async mark_all(seen = true, read = false) {
    const args = []
    if (seen && this.track_unseen)
      args.push('unseen')
    if (read && this.track_unread)
      args.push('unread')
    await this.feedMarkers.flush(args)
  }


  // '''
  // Deletes the feed and its markers.
  // '''
  async delete() {
    super.delete()

    const args = []
    if (this.track_unseen)
      args.push('unseen')
    if (this.track_unread)
      args.push('unread')
    await this.feedMarkers.flush(args)
  }

}