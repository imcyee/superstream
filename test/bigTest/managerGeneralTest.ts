import faker from "@faker-js/faker"
import { Manager } from "../../src"
import { generateActivity } from "../utils/generateActivity"
import { wait } from "../utils/wait"

export const defaultTaskTimeout = 8000

export async function addUserActivity<T extends Manager>(feedManager: T) {
  const followers = [
    faker.datatype.uuid(),
    faker.datatype.uuid()
  ]
  // @ts-ignore
  jest.spyOn(feedManager, 'getUserFollowerIds').mockImplementation(async () => ({
    'HIGH': followers
  }));
  const userId = faker.datatype.uuid()
  const activity1 = generateActivity()
  await feedManager.addUserActivity(userId, activity1)
  // current user feed
  const userFeed = feedManager.getUserFeed(userId)
  const activities = await userFeed.getItem(0, 5)
  expect(activities.length).toBe(1)
}

export async function testAbleToFanout<T extends Manager>(feedManager: T) {
  const userId = faker.datatype.uuid()
  const followers = [
    faker.datatype.uuid(),
    faker.datatype.uuid()
  ]
  // @ts-ignore
  jest.spyOn(feedManager, 'getUserFollowerIds').mockImplementation(async () => ({
    'HIGH': followers
  }));

  const followerFeed = feedManager.getUserFeed(followers[0])
  const followerFeedItem0 = await followerFeed.getItem(0, 5)
  expect(followerFeedItem0.length).toBe(0)

  await feedManager.addUserActivity(userId, generateActivity())

  // current user feed
  const userFeed = feedManager.getUserFeed(userId)
  const activities = await userFeed.getItem(0, 5)
  expect(activities.length).toBe(1)

  // fanout is slow if we test it right away we will get different result
  // task is executed in seperated process
  await wait(2500)

  // follower user feed 
  const followerFeedItem1 = await followerFeed.getItem(0, 5)
  expect(followerFeedItem1.length).toBe(1)

  // add another entry 
  await feedManager.addUserActivity(userId, generateActivity())

  // fanout is slow if we test it right away we will get different result
  // task is executed in seperated process
  await wait(2500)

  // follower user feed
  const followerFeedItem2 = await followerFeed.getItem(0, 5)
  expect(followerFeedItem2.length).toBe(2)
}

export async function testAbleToRemoveActivitiesForFollower(feedManager) {
  const userId = faker.datatype.uuid()

  const followers = [
    faker.datatype.uuid(),
    faker.datatype.uuid()
  ]
  jest.spyOn(feedManager, 'getUserFollowerIds').mockImplementation(async () => ({
    'HIGH': followers
  }));

  const activity1 = generateActivity()
  await feedManager.addUserActivity(userId, activity1)

  // current user feed
  const userFeed = feedManager.getUserFeed(userId)
  const followerFeed = feedManager.getUserFeed(followers[0])

  const activities = await userFeed.getItem(0, 5)
  const followerFeedItem = await followerFeed.getItem(0, 5)
  expect(activities.length).toBe(1)
  expect(followerFeedItem.length).toBe(1)

  await feedManager.removeUserActivity(userId, activity1)


  // task is executed in seperated process
  await wait(2500)


  const activities2 = await userFeed.getItem(0, 5)
  const followerFeedItem2 = await followerFeed.getItem(0, 5)
  expect(activities2.length).toBe(0)
  expect(followerFeedItem2.length).toBe(0)
}

export async function followUserAndCopyContent(feedManager) {
  const userId = faker.datatype.uuid()

  const followers = []
  jest.spyOn(feedManager, 'getUserFollowerIds').mockImplementation(async () => ({
    'HIGH': followers
  }));

  const newUserId = faker.datatype.uuid()
  const activity1 = generateActivity({
    actor: `user:${userId}`,
    target: `user:${newUserId}`,
  })
  await feedManager.addUserActivity(userId, activity1)

  // current user feed
  const userFeed = feedManager.getUserFeed(userId)

  const activities = await userFeed.getItem(0, 5)
  expect(activities.length).toBe(1)


  await feedManager.followUser(newUserId, userId)

  // task is executed in seperated process
  await wait(5000)

  const newUserFeed = feedManager.getUserFeed(newUserId)

  const activities1 = await newUserFeed.getItem(0, 5)

  expect(activities1.length).toBe(1)

}

export async function unfollowAndRemoveContent(feedManager) {
  const userId = faker.datatype.uuid()

  const followers = []
  jest.spyOn(feedManager, 'getUserFollowerIds').mockImplementation(async () => ({
    'HIGH': followers
  }));

  const newUserId = faker.datatype.uuid()
  const activity1 = generateActivity({
    actor: `user:${userId}`,
    target: `user:${newUserId}`,
  })
  await feedManager.addUserActivity(userId, activity1)

  // current user feed
  const userFeed = feedManager.getUserFeed(userId)

  const activities = await userFeed.getItem(0, 5)
  expect(activities.length).toBe(1)

  await feedManager.followUser(newUserId, userId)
  const newUserFeed = feedManager.getUserFeed(newUserId)

  // task is executed in seperated process
  await wait(2000)
  var newUserActivities = await newUserFeed.getItem(0, 5)
  expect(newUserActivities.length).toBe(1)


  await feedManager.unfollowUser(newUserId, userId)

  // task is executed in seperated process
  await wait(2000)
  newUserActivities = await newUserFeed.getItem(0, 5)
  expect(newUserActivities.length).toBe(0)
}

export async function ableToUpdateUserActivity(feedManager) {
  const followers = [
    faker.datatype.uuid(),
    faker.datatype.uuid()
  ]
  // @ts-ignore
  jest.spyOn(feedManager, 'getUserFollowerIds').mockImplementation(async () => ({
    'HIGH': followers
  }));

  const userId = faker.datatype.uuid()

  const activity1 = generateActivity({
    actorId: userId
  })
  await feedManager.addUserActivity(userId, activity1)

  const activity2 = generateActivity({
    actorId: userId,
    serializationId: activity1.serializationId
  })

  await feedManager.updateUserActivity(activity2)
  // current user feed
  const userFeed = feedManager.getUserFeed(userId)
  const activities = await userFeed.getItem(0, 5)

  console.log('activities in test', activities);
  expect(activities.length).toBe(1)
  expect(activities[0].objectId).not.toBe(activity1.objectId)


}