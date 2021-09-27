
import SDC from 'statsd-client'
import { Metrics, NoopTimer } from './base'

var statsd: SDC

/**
 * @example 
 * const timer = new Timer()
 * timer.start()
 * ....more codes 
 * timer.stop() // send timing to statsd
 */
class Timer extends NoopTimer {

  metricName
  timer
  // record the start of the timer
  startDate

  constructor(metricName) {
    super()
    this.metricName = metricName
  }

  start() {
    this.startDate = new Date()
  }

  stop() {
    if (!this.startDate)
      console.error('startDate is not found, you may have forgetten to call start()');

    statsd.timing(this.metricName, this.startDate)
  }

  // __enter__() {
  //   this.timer = statsd.Timer(this.metricName)
  //   this.timer.start()
  // }

  // __exit__(args) {
  //   this.timer.stop()
  // }

}

export class StatsdMetrics extends Metrics {
  prefix

  constructor(host = 'localhost', port = 8125, prefix = 'superstream') {
    super()
    statsd = new SDC({
      host,
      port
    });
    // statsd.Connection.set_defaults(host = host, port = port)
    this.prefix = prefix
  }

  fanoutTimer(feedClass) {
    const toName = (prefix, feedClass_name) => `${prefix}.${feedClass_name}.fanout_latency`
    return new Timer(toName(this.prefix, feedClass.name))
  }

  feed_reads_timer(feedClass) {
    const toName = (prefix, feedClass_namee) => `${prefix}.${feedClass_namee}.read_latency`
    return new Timer(toName(this.prefix, feedClass.name))
  }

  onFeedRead(feedClass, activities_count) {
    const toName = (prefix, feedClass_name) => `${prefix}.${feedClass_name}.reads`
    statsd.increment(
      toName(this.prefix, feedClass.name),
      activities_count
    )
  }

  onFeedWrite(feedClass, activities_count) {
    const toName = (prefix, feedClass_name) => `${prefix}.${feedClass_name}.writes`
    statsd.increment(
      toName(this.prefix, feedClass.name),
      activities_count
    )
  }

  onFeedRemove(feedClass, activities_count) {
    const toName = (prefix, feedClass_name) => `${prefix}.${feedClass_name}.deletes`
    statsd.increment(
      toName(this.prefix, feedClass.name),
      activities_count
    )
  }

  on_fanout(feedClass, operation, activities_count = 1) {
    const toName = (prefix, feedClass_name, operation_name) => `${prefix}.${feedClass_name}.fanout.${operation_name}`
    statsd.increment(
      toName(this.prefix, feedClass.name, operation.name),
      activities_count
    )
  }

  on_activity_published() {
    const toName = (prefix) => `${prefix}.activities.published`
    statsd.increment(toName(this.prefix))
  }

  on_activity_removed() {
    const toName = (prefix) => `${prefix}.activities.removed`
    statsd.increment(toName(this.prefix))
  }
}

/**
 * 🔥 temporary
 */
const statsdMetrics = new StatsdMetrics()
export const getMetricsInstance = () => {
  return statsdMetrics
}