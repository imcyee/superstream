export class NoopTimer {
  __enter__() { }
  __exit__(args) { }
}

export class Metrics {
  fanoutTimer(feedClass) {
    return new NoopTimer()
  }
  feed_reads_timer(feedClass) {
    return new NoopTimer()
  }
  on_feed_read(feedClass, activities_count) { }
  on_feed_remove(feedClass, activities_count) { }
  on_feed_write(feedClass, activities_count) { }
  on_fanout(feedClass, operation, activities_count = 1) { }
  on_activity_published(self) { }
  on_activity_removed(self) { }
}