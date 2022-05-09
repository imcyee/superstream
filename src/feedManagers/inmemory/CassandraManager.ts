import { Mixin } from "ts-mixer"
import { InMemoryFeed } from "../../feeds/InMemoryFeed"
import { UserBaseFeed } from "../../feeds/UserBaseFeed"
import { Manager } from "../base"
import { RegisterManager } from "../registerManager"

class InMemoryUserBaseFeed extends Mixin(UserBaseFeed, InMemoryFeed) { }

@RegisterManager()
export class InMemoryManager extends Manager {
  UserFeedClass = InMemoryUserBaseFeed
  get FeedClasses() {
    return {
      'feed': InMemoryFeed
    }
  }
}


// @pytest.mark.usefixtures("cassandra_reset")
// class RedisManagerTest(BaseManagerTest):
//     manager_class = CassandraManager
