import faker from '@faker-js/faker'
import { InMemoryManager } from '../../../src/feedManagers/inmemory/CassandraManager'
import { generateActivity } from '../../utils/generateActivity'

const taskStub = {
  fanoutQueue: { add: () => { } },
  followManyQueue: { add: () => { } },
  unfollowManyQueue: { add: () => { } },
}

describe("In memory", () => {
  it("", async () => {
    
    const userId = faker.datatype.uuid()
    // const feedManager = new InMemoryManager({ tasks: setupProps.taskQueues })
    const feedManager = new InMemoryManager({
      tasks: taskStub as any
    })

    const activity1 = generateActivity()
    await feedManager.addUserActivity(userId, activity1)

    // current user feed
    const userFeed = feedManager.getUserFeed(userId)
    const activities = await userFeed.getItem(0, 5)
    expect(activities.length).toBe(1)
  })

  
})