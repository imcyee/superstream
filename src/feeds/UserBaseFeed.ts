
import { RedisFeed } from ".."
import { BaseFeed } from "./base/base"

// // Implementation of the base feed with a different
// // Key format and a really large maxLength
// export class UserBaseFeed extends BaseFeed {
//   keyFormat = (userId) => `user_feed:${userId}`
//   get maxLength() { return 10 ** 6 }
// }


// Implementation of the base feed with a different
// Key format and a really large maxLength
export class UserBaseFeed extends RedisFeed {
  keyFormat = (userId) => `user_feed:${userId}`
  get maxLength() { return 10 ** 6 }
}