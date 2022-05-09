import express from 'express'; 
import { FeedManagerService } from '../service/feedManager.service'; 

const router = express.Router(); 

router.route('/feeds')
  // implement group
  // eg: notification, timeline, user
  // each group will store it differently
  .get(async (req, res) => {
    const { group, userId, offset, limit } = req.query

    if (!userId)
      throw new Error('Missing userId')

    if (Number(limit) > 100)
      throw new Error("max limit 100")

    const feedManagerService = new FeedManagerService()
    const feedActivities = await feedManagerService.getFeedActivity({
      userId,
      limit,
      offset
    })
    return res.json(feedActivities)
  })

  .post(async (req, res) => {
    const { group, userId } = req.query
    if (!userId)
      throw new Error('Missing userId')
    const { actorId, verbId, objectId, targetId, time, context } = req.body
    const feedManagerService = new FeedManagerService()
    const result = await feedManagerService.addFeedActivity(userId, {
      actorId,
      verbId,
      objectId,
      targetId,
      time,
      context
    })

    return res.json(result)
  })
// .delete(async (req, res) => {
//   const { group, id } = req.query
//   const { activityId } = req.body
//   const cassandraFeed = new CassandraFeed(id)
//   const result = await cassandraFeed.remove(activityId)
//   return res.json(result)
// })


export default router