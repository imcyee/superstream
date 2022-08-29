import { faker } from '@faker-js/faker';
import { Activity } from '../../src/activity/Activity'
import { ActivitySerializer } from '../../src/serializers/ActivitySerializer';
import { generateActivity } from '../utils/generateActivity';
import { NotificationAggregator } from '../../src/aggregators/notification.aggregator'

describe('Activity Aggregator', () => {

  let notificationAggregator: NotificationAggregator

  beforeEach(() => {
    notificationAggregator = new NotificationAggregator({
      ActivityClass: Activity
    })
  })

  it("should be able to instantiate", () => {
    expect(notificationAggregator instanceof NotificationAggregator).toBeTruthy()
  })


  it("should be able to group activities", () => {
    const activities = new Array(3).fill(5).map(() => generateActivity({
      objectId: 'abc',
      verbId: 'efg'
    }))
    const aggregatedActivity = notificationAggregator
      .groupActivities(activities)
    expect(Object.keys(aggregatedActivity).length).toBe(1)
  })

  it("should be able to aggregate activities", () => {
    const activities = new Array(3).fill(5).map(
      () => generateActivity({
        objectId: 'abc',
        verbId: 'efg'
      })
    )
    const aggregatedActivity = notificationAggregator.aggregate(activities)
    console.log(aggregatedActivity);
    expect(aggregatedActivity.length).toBe(1)
  })

  it("should be able to merge activities", () => {
    const activities = new Array(3).fill(5).map(
      () => generateActivity({
        objectId: 'abc',
        verbId: 'efg'
      })
    )
    const aggregatedActivity = notificationAggregator.aggregate(activities)
    expect(aggregatedActivity.length).toBe(1)

    const result = notificationAggregator.merge(aggregatedActivity, activities)
    console.log(result);

  })
})