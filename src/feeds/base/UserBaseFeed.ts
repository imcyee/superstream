
import { BaseFeed } from "./base"

// Implementation of the base feed with a different
// Key format and a really large maxLength
export class UserBaseFeed extends BaseFeed {
  keyFormat = (userId) => `user_feed:${userId}`
  maxLength = 10 ** 6
}