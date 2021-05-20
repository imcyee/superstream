import { DehydratedActivity } from "../activity"
import { BaseSerializer } from "./base"


export class SimpleTimelineSerializer extends BaseSerializer {

  loads({
    serialized_activity,
    ...kwargs
  }) {
    return new DehydratedActivity({
      serialization_id: serialized_activity
    })
  }

  dumps({
    activity,
    ...kwargs }) {
    // '''
    // Returns the serialized version of activity and the
    // '''
    return activity.serialization_id
  }
}
