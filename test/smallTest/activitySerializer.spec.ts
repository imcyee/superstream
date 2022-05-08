import { faker } from '@faker-js/faker';
import { Activity } from '../../src/activity/Activity'
import { ActivitySerializer } from '../../src/serializers/ActivitySerializer';
import { generateActivity } from '../utils/generateActivity';

describe('Activity serializer', () => {

  let activitySerializer: ActivitySerializer

  beforeEach(() => {
    activitySerializer = new ActivitySerializer({
      ActivityClass: Activity
    })
  })

  it("should be able to instantiate", () => {
    expect(activitySerializer instanceof ActivitySerializer).toBeTruthy()
  })

  it("should be able to dump as string", () => {
    const activity = generateActivity()
    const dumpedActivity = activitySerializer.dumps(activity)
    console.log(dumpedActivity);
    console.log(dumpedActivity);
    expect(typeof dumpedActivity).toBe('string')
  })

  it("should be able to loaded from string", () => {
    const serializationId = "b6846250-cd5b-11ec-9caa-9f657c861e72"
    let dumpedString = `${serializationId},user:f2367727-ee54-4625-807f-54e01a37e5cc,themepark:go,movie:54603,null,1651855432.949000`
    const activity = activitySerializer.loads(dumpedString)
    console.log(activity);

    expect(activity instanceof Activity).toBeTruthy()
    expect(activity.serializationId).toBe(serializationId)
  })
})