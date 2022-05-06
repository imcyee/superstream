import express from 'express'; 
import { Activity } from "../../src/activity/Activity";
import { getStorageManagerClass } from '../utils/getStorageManagerClass';
import { getStorageName } from '../utils/getStorageName';

const router = express.Router(); 
const CustomManager = getStorageManagerClass(getStorageName())

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
    const { actorId, verbId, objectId, targetId, time, context } = req.body
    const { group, userId } = req.query
    const manager = new CustomManager()
    const activity = new Activity({
      actor: actorId,
      verb: verbId,
      object: objectId,
      target: targetId,
      time: time || new Date(),
      context: context
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