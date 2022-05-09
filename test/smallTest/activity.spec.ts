import { faker } from '@faker-js/faker';
import { Activity } from '../../src/activity/Activity'

const validActivityPayload = {
  actorId: faker.datatype.uuid(),
  targetId: faker.datatype.uuid(),
  verbId: faker.datatype.uuid(),
  objectId: faker.datatype.uuid()
}

describe('Activity', () => {
  it("should fail if incomplete activity payload", () => {
    let err
    try {
      new Activity({
        actorId: faker.datatype.uuid()
      })
    } catch (error) {
      err = error
    }
    expect(err).toBeDefined()
  })

  it("should be instantiated when all activity payload are fine", () => {
    const activity = new Activity(validActivityPayload)
    expect(activity instanceof Activity).toBeTruthy()
  })

  it("serializationId be instantiated when it is not provided", () => {
    const activity = new Activity(validActivityPayload)
    expect(activity.serializationId).toBeDefined()
  })

  it("serializationId be the same if it is provided", () => {
    const serializationId = faker.datatype.uuid()
    const activity = new Activity({
      serializationId,
      ...validActivityPayload
    })
    expect(activity.serializationId).toBe(serializationId)
  })
})