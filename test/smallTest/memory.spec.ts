import { DummySerializer } from '../../src/serializers/dummy'
import { InMemoryActivityStorage } from '../../src/storage/memory'
import { v4 } from 'uuid'

const generateMemoryActivity = () => ({
  activityId: v4()
})

describe("memory", () => {
  it("Should be able to insert item", async () => {
    const activityStorage = new InMemoryActivityStorage({
      SerializerClass: DummySerializer
    })
    const activityId = v4()
    await activityStorage.addToStorage({
      [activityId]: generateMemoryActivity()
    }, {})

    const results = await activityStorage.getFromStorage([activityId], {})
    const filteredResults = Object.values(results).filter((r) => {
      return r
    })
    expect(filteredResults.length).toBe(1)
  })

  it("Should be able to remove item", async () => {
    const activityStorage = new InMemoryActivityStorage({
      SerializerClass: DummySerializer
    })
    const activityId = v4()
    await activityStorage.flush()

    await activityStorage.addToStorage({
      [activityId]: generateMemoryActivity()
    }, {})

    await activityStorage.removeFromStorage([activityId], {})


    const results = await activityStorage.getFromStorage([activityId], {})
    console.log(results);
    const filteredResults = Object.values(results).filter((r) => {
      return r
    })
    expect(filteredResults.length).toBe(0)
  })
})