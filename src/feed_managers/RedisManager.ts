import { Mixin } from "ts-mixer"
import { Manager, RedisFeed } from ".."
import { UserBaseFeed } from "../feeds/UserBaseFeed"

class RedisUserBaseFeed extends Mixin(UserBaseFeed, RedisFeed) { }

export class RedisManager extends Manager {
  UserFeedClass = RedisUserBaseFeed
  get FeedClasses() {
    return {
      'feed': RedisFeed
    }
  }
}

