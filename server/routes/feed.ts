import { CassandraFeed } from "../../src/feeds/cassandra";
import express from 'express';
import { Activity } from "../../src/activity/Activity";
import { Add } from "../../src/verbs/base";

// import { Manager } from '../../src/feed_managers/base'
import { CustomManager } from "../manager/CustomManger";

const router = express.Router();

// router.route('/feeds')
//   // implement group
//   // eg: notification, timeline, user
//   // each group will store it differently
//   .get(async (req, res) => {
//     const query = req.query
//     const { offset, limit, group, id } = query

//     if (limit > 100)
//       throw new Error("max limit 100")

//     const cassandraFeed = new CassandraFeed(id)

//     const results = await cassandraFeed.getItem(offset, limit)

//     return res.json(results)
//   })
//   .post(async (req, res) => {
//     const { actorId, verbId, objectId, targetId, time, extraContext } = req.body
//     const { group, id } = req.query
//     const cassandraFeed = new CassandraFeed(id)
//     const activity = new Activity({
//       actor: actorId,
//       verb: verbId,
//       object: objectId,
//       target: targetId,
//       time,
//       extraContext: extraContext
//     })
//     const result = await cassandraFeed.add(activity)
//     return res.json(result)
//   })
//   .delete(async (req, res) => {
//     const { group, id } = req.query
//     const { activityId } = req.body
//     const cassandraFeed = new CassandraFeed(id)
//     const result = await cassandraFeed.remove(activityId)
//     return res.json(result)
//   })



router.route('/feeds')
  // implement group
  // eg: notification, timeline, user
  // each group will store it differently
  .get(async (req, res) => {
    console.log('getting feeds');
    const { group, userId, offset, limit } = req.query
    if (Number(limit) > 100)
      throw new Error("max limit 100")
    const manager = new CustomManager()
    const userFeed = manager.getUserFeed(userId)
    const results = await userFeed.getItem(Number(offset), Number(limit))
    return res.json(results)
  })
  .post(async (req, res) => {
    console.log('adding feeds');
    const { actorId, verbId, objectId, targetId, time, extraContext } = req.body
    const { group, userId } = req.query
    const manager = new CustomManager()
    const activity = new Activity({
      actor: actorId,
      verb: verbId,
      object: objectId,
      target: targetId,
      time: time || new Date(),
      extraContext: extraContext
    })
    const result = await manager.addUserActivity(userId, activity)
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