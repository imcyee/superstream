import { BaseFeed } from "./base/base"
 
// Implementation of the base feed with a different
// Key format and a really large maxLength
// export class UserBaseFeed extends BaseFeed {
export class UserBaseFeed extends BaseFeed {
  keyFormat = (userId) => `user_feed:${userId}`
  get maxLength() { return 10 ** 6 }
}