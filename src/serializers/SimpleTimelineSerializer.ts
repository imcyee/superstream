 
import { DehydratedActivity } from "../activity/DehydratedActivity"
import { BaseSerializer } from "./BaseSerializer"

export class SimpleTimelineSerializer extends BaseSerializer {

  loads(serializationId, kwargs) {
    return new DehydratedActivity(serializationId)
  }

  // Returns the serialized version of activity and the
  dumps(activity) {
    return activity.serializationId
  }
}
