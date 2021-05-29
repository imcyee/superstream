import { CassandraFeed } from "../feeds/cassandra";
import express from 'express';
import { Activity } from "../activity";
import { Add } from "../verbs/base";

const router = express.Router();

router.route('/feeds')
  // get feeds
  .get(async (req, res) => {
    const query = req.query
    const { offset, limit, group, id } = query

    if (limit > 100)
      throw new Error("max limit 100")

    const cassandraFeed = new CassandraFeed({
      user_id: `${group}:${id}`
    })

    const results = await cassandraFeed.get_item(offset, limit)
    return res.json(results)
  })

  // add feed
  .post(async (req, res) => {
    const { actorId, verbId, objectId, targetId, time, extraContext } = req.body
    const { group, id } = req.query
    const cassandraFeed = new CassandraFeed({ user_id: `${group}:${id}` })
    console.log(actorId, verbId, objectId, targetId, time, extraContext);
    const activity = new Activity({
      actor: actorId,
      verb: verbId,
      object: objectId,
      target: targetId,
      time,
      extra_context: extraContext
    })
    const result = await cassandraFeed.add(activity)
    console.log(result);
    return res.json(result)
  })


export default router