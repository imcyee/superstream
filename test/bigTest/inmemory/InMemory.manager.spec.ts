// import supportsColor from 'supports-color';
import { InMemoryManager } from '../../../src/feedManagers/inmemory/InMemoryManager';
import { ableToUpdateUserActivity, addUserActivity } from '../managerGeneralTest';


const taskStub = {
  fanoutQueue: { add: () => { } },
  followManyQueue: { add: () => { } },
  unfollowManyQueue: { add: () => { } },
}



describe("In memory", () => {
  it("Able to add user activity", async () => {
    const feedManager = new InMemoryManager({
      tasks: taskStub as any
    })
    await addUserActivity(feedManager)
  });

  it("Able to update user activity", async () => {
    const feedManager = new InMemoryManager({
      tasks: taskStub as any
    })
    await ableToUpdateUserActivity(feedManager)
 
  });

})