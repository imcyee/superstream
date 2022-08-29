import { Activity } from "../activity/Activity"
import { ValueError } from "../errors"

// The base serializer class, only defines the signature for
// loads and dumps
// It serializes Activity objects
export abstract class BaseSerializer {

  ActivityClass

  constructor({
    ActivityClass,
    ...kwargs
  }) {
    this.ActivityClass = ActivityClass
  }

  checkType(data) {
    console.log('data', data);
    console.log('!(data instanceof Activity)', !(data instanceof Activity));
    if (!(data instanceof Activity)) {
      console.log('throwing error');
      throw new ValueError(`we only know how to dump activities, not ${typeof (data)}`)
    }
  }

  loads(serializedActivity, options?) {
    const activity = serializedActivity
    return activity
  }

  dumps(activity, options?) {
    this.checkType(activity)
    return activity
  }
}
