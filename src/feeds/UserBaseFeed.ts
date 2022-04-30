
import { Activity, RedisFeed } from ".."
import { BaseSerializer } from "../serializers/BaseSerializer"
import { BaseActivityStorage } from "../storage/base/base_activity_storage"
import { BaseTimelineStorage } from "../storage/base/base_timeline_storage"
import { BaseFeed } from "./base/base"

// // Implementation of the base feed with a different
// // Key format and a really large maxLength
// export class UserBaseFeed extends BaseFeed {
//   keyFormat = (userId) => `user_feed:${userId}`
//   get maxLength() { return 10 ** 6 }
// }


// // Implementation of the base feed with a different
// // Key format and a really large maxLength
// // export class UserBaseFeed extends BaseFeed {
// export class UserBaseFeed extends RedisFeed {
//   keyFormat = (userId) => `user_feed:${userId}`
//   get maxLength() { return 10 ** 6 }
// }


// Implementation of the base feed with a different
// Key format and a really large maxLength
// export class UserBaseFeed extends BaseFeed {
export class UserBaseFeed extends BaseFeed {
  keyFormat = (userId) => `user_feed:${userId}`
  get maxLength() { return 10 ** 6 }
}