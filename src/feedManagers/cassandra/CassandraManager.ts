// from stream_framework.feedManagers.base import { Mixin } from "ts-mixer"
// import Manager
// from stream_framework.feeds.base import UserBaseFeed
// from stream_framework.feeds.cassandra import CassandraFeed
// from stream_framework.tests.managers.base import BaseManagerTest
// import pytest

import { Mixin } from "ts-mixer"
import { CassandraFeed } from "../../feeds/cassandra"
import { UserBaseFeed } from "../../feeds/UserBaseFeed"
import { Manager } from "../base"
import { RegisterManager } from "../registerManager"

class CassandraUserBaseFeed extends Mixin(UserBaseFeed, CassandraFeed) { }

@RegisterManager()
export class CassandraManager extends Manager {
  UserFeedClass = CassandraUserBaseFeed
  get FeedClasses() {
    return {
      'feed': CassandraFeed
    }
  }
}


// @pytest.mark.usefixtures("cassandra_reset")
// class RedisManagerTest(BaseManagerTest):
//     manager_class = CassandraManager
