import { Activity } from "../../src"
import { getTaskProps } from "../server"
import { getStorageManagerClass } from "../utils/getStorageManagerClass"
import { getStorageName } from "../utils/getStorageName"
import { Manager } from '../../src/feedManagers/base'

const CustomManager = getStorageManagerClass(getStorageName())

export class FeedManagerService<T extends Manager> {

  manager: T

  constructor() {
    const taskProps = getTaskProps()
    this.manager = new CustomManager({
      tasks: taskProps.taskQueues
    })
  }

  async getFeedActivity({ userId, offset, limit }) {
    const userFeed = this.manager.getUserFeed(userId)
    const results = await userFeed.getItem(Number(offset), Number(limit))
    return results
  }

  async addFeedActivity(userId, {
    actorId,
    verbId,
    objectId,
    targetId,
    time,
    context
  }) {
    console.log(
      actorId,'actorId',
      verbId,
      objectId,
      targetId,
      time,
      context

    );
    const activity = new Activity({
      actor: actorId,
      verb: verbId,
      object: objectId,
      target: targetId,
      time: time || new Date(),
      context: context
    })
    const result = await this.manager.addUserActivity(userId, activity)
    return result
  }
}