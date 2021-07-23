import { AggregatedActivity } from "./AggregatedActivity"


export class NotificationActivity extends AggregatedActivity {
  is_seen
  is_read
  constructor(kwargs) {
    super(kwargs)

    // # overrides AggregatedActivity is_read & is_seen instance methods
    this.is_seen = false
    this.is_read = false
  }
}
