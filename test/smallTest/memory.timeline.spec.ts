import { DummySerializer } from '../../src/serializers/dummy'
import { InMemoryTimelineStorage } from '../../src/storage/memory/InMemoryTimelineStorage'
import { v4 } from 'uuid'
import { Activity } from '../../src/activity/Activity'

const generateMemoryActivity = () => ({
  activityId: v4()
})

describe("memory timeline", () => {

  afterEach
  it("Should be able to insert item", async () => {

    const activityStorage = new InMemoryTimelineStorage({
      SerializerClass: DummySerializer,
      ActivityClass: Activity
    })
    const key = v4()

    const activity = generateMemoryActivity()
    await activityStorage.addToStorage(key, {
      [activity.activityId]: activity
    }, {})

    const results = await activityStorage.getSliceFromStorage(
      { key, start: 0, stop: 10 }
    )
    expect(results.length).toBe(1)
  })

})