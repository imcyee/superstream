import { Mixin } from "ts-mixer"
import { Manager, RedisFeed } from "../.."
import { UserBaseFeed } from "../../feeds/UserBaseFeed"
import { RegisterManager } from "../registerManager"

class RedisUserBaseFeed extends Mixin(UserBaseFeed, RedisFeed) { }
 
@RegisterManager()
export class RedisManager extends Manager {
  UserFeedClass = RedisUserBaseFeed
  get FeedClasses() {
    return {
      'feed': RedisFeed
    }
  }
}

