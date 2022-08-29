import { Mixin } from "ts-mixer"
import { InMemoryFeed } from "../../feeds/InMemoryFeed"
import { UserBaseFeed } from "../../feeds/UserBaseFeed"
import { Manager } from "../base"
import { RegisterManager } from "../registerManager"
import supportsColor from 'supports-color';

// const supportsColor = require('supports-color');
console.log('supportsColor.stdout',supportsColor.stdout);
if (supportsColor.stdout) {
  console.log('Terminal stdout supports color');
}



class InMemoryUserBaseFeed extends Mixin(UserBaseFeed, InMemoryFeed) { }

/**
 * InMemory doesnt support fanout yet
 */
@RegisterManager()
export class InMemoryManager extends Manager {
  UserFeedClass = InMemoryUserBaseFeed
  get FeedClasses() {
    return {
      'feed': InMemoryFeed
    }
  }
}
