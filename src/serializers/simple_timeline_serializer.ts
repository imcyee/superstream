import { DehydratedActivity } from "../activity"
import { BaseSerializer } from "./base"


export class SimpleTimelineSerializer extends BaseSerializer {

  loads(serialization_id, kwargs) {
    return new DehydratedActivity(serialization_id)
  }

  // async dumps({
  //   activity,
  //   ...kwargs }
  // ) {
  dumps(activity) {
    // '''
    // Returns the serialized version of activity and the
    // '''
    return activity.serialization_id
  }
}
