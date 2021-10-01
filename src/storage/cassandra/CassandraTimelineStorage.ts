import * as cassandra from 'cassandra-driver'
import { NotImplementedError, ValueError } from "../../errors"
import { CassandraActivitySerializer } from "../../serializers/cassandra/CassandraActivitySerializer"
import { BaseTimelineStorage } from "../base"
import { getClient } from "./connection"
import { models } from "./models"

const keyspace = 'stream'
const q = cassandra.mapping.q;


/**
 * How cassandra saves feeds
 * 
 * Each row has data as such
 *  feed_id ascii, 
 *  actor_id ascii, 
 *  extra_context blob, 
 *  object_id ascii,
 *  target_id ascii,
 *  time timestamp,
 *  verb_id ascii,
 *  activities blob,
 *  created_at timestamp,
 *  group ascii,
 *  updated_at timestamp, 
 *  activity_id varint, 
 * 
 * Aggregated and user feed both are store together
 * Hence, activities is null for user feed
 * and others field such as actor_id will be null for aggregated
 */


// A feed timeline implementation that uses Apache Cassandra 2.0 for storage.
// CQL3 is used to access the data stored on Cassandra via the ORM
// library CqlEngine.
export class CassandraTimelineStorage extends BaseTimelineStorage {
  DefaultSerializerClass = CassandraActivitySerializer
  insert_batch_size = 100

  model: cassandra.mapping.ModelMapper<any>
  baseModel
  columnFamilyName

  mapper: cassandra.mapping.Mapper
  client: cassandra.Client

  constructor({
    SerializerClass = null,
    modelClass = models.Activity,
    columnFamilyName,
    ...options
  }) {
    super({ SerializerClass, ...options })
    this.columnFamilyName = columnFamilyName
    this.baseModel = modelClass
    this.client = getClient()
    const Mapper = cassandra.mapping.Mapper;
    this.mapper = new Mapper(this.client, {
      models: {
        'Activity': {
          keyspace,
          tables: ['feeds'],
        },
      }
    });
    this.model = this.mapper.forModel(modelClass)
  }



  async addToStorage(
    key,
    activities,
    {
      batchInterface = null,
      kwargs
    }
  ) {
    const changes = []
    for (const modelInstance of Object.values(activities)) {
      // @ts-ignore
      modelInstance.feed_id = key.toString()
      changes.push(this.model.batching.insert(modelInstance))
    }

    const results = await this.mapper.batch(changes)
    return results.toArray()
  }

  async removeFromStorage(
    key,
    activities,
    { batchInterface = null }
  ) {
    const changes = []
    for (const activityId of Object.keys(activities)) {
      changes.push(this.model.batching.remove({
        feed_id: key,
        activity_id: activityId
      }))
    }
    await this.mapper.batch(changes)
  }

  // trim using Cassandra's tombstones black magic
  // retrieve the WRITETIME of the last item we want to keep
  // then delete everything written after that
  // this is still pretty inefficient since it needs to retrieve
  // length amount of items
  // WARNING: since activities created using Batch share the same timestamp
  // trim can trash up to (batch_size - 1) more activities than requested
  async trim(key, maxLength, batchInterface = null) {
    const variable = this.baseModel === models.Activity
      ? 'verbId' // must make sure null is not allow to be empty
      : 'group'

    const query = `
      SELECT 
        WRITETIME(${variable}) as wt 
      FROM 
        ${keyspace}.${this.columnFamilyName} 
      WHERE 
        feed_id=? 
      ORDER BY 
        activity_id DESC 
      LIMIT 
        ?;
    `

    const parameters = [,
      key,
      maxLength + 1
    ]

    const results = await this.client.execute(query, parameters, { prepare: true })

    // # compatibility with both cassandra driver 2.7 and 3.0
    const results_length = results.rowLength

    // length is still within max
    if (results_length < maxLength)
      return

    const { rows } = results
    const rowsLength = rows.length

    // beware of this function delete with timestamp larger than current time will remove all records up till the timestamp
    // anything that insert after that timestamp is unable to insert
    const trim_ts_number = (Number(rows[rowsLength - 1]['wt']) + Number(rows[rowsLength - 2]['wt'])) / 2
    const trim_ts = Math.floor(trim_ts_number)

    // safety check 
    if (trim_ts > Date.now() * 1000) // in micro
      throw new Error("trim timestamp should not be more than current timestamp")

    const delete_query = `DELETE FROM ${keyspace}.${this.columnFamilyName} USING TIMESTAMP ? WHERE feed_id=?;`
    const delete_params = [
      trim_ts, // in microseconds
      key
    ]

    await this.client.execute(delete_query, delete_params, { prepare: true })
  }

  async count(key) {
    const results = (await this.model.find({ feed_id: key })).toArray().length
    return results
  }

  async delete(key) {
    return await this.model.remove({ feed_id: key })
  }


  // overwriting parent method
  // Returns an instance of the serializer class
  get serializer() {
    const SerializerClass = this.SerializerClass
    const kwargs = {}
    if (this['AggregatedActivityClass'])
      kwargs['AggregatedActivityClass'] = this.AggregatedActivityClass

    const serializerInstance = new SerializerClass({
      model: this.model,
      ActivityClass: this.ActivityClass,
      ...kwargs
    })
    return serializerInstance
  }

  async contains(key, activityId) {
    const results = await this.model.find({ feed_id: key, activityId })
    return results.toArray().length > 0
    // return this.model.objects.filter(feed_id = key, activityId = activityId).count() > 0
  }

  async indexOf(key, activityId) {
    const hasActivity = await this.contains(key, activityId)
    if (!hasActivity)
      throw new ValueError()

    const results = await this.model.find({
      feed_id: key,
      activityId: q.gt(activityId)
    })

    return results.toArray().length
    // return this.model.objects.filter(feed_id = key, activity_id__gt = activityId).count()
  }

  getOrderingOrDefault(orderingArgs) {
    var ordering
    if (!orderingArgs)
      ordering = { 'activity_id': 'asc' }
    else
      ordering = orderingArgs
    return ordering
  }

  async get_nth_item(key, index, orderingArgs = null) {
    const ordering = this.getOrderingOrDefault(orderingArgs)
    const results = (await this.model.find(
      { feed_id: key, },
      { orderBy: ordering, limit: (index + 1) }
    )).toArray()
    return results[index]
  }

  // :returns list: Returns a list with tuples of key,value pairs
  async getSliceFromStorage({
    key,
    start,
    stop,
    filterKwargs = null,
    orderingArgs = null
  }) {
    const results = []
    var limit = 10 ** 6

    const ordering = this.getOrderingOrDefault(orderingArgs)

    var findOptions = {} as any;
    findOptions.feed_id = key

    if (filterKwargs) {
      findOptions = {
        ...findOptions,
        ...filterKwargs
      }
    }

    try {
      if (start === null || start != 0) {
        const offsetActivityId = await this.get_nth_item(key, start, ordering)
        findOptions = { ...findOptions, activityId: q.lte(offsetActivityId.activityId) }
      }
    } catch (err) {
      console.error(err);
      console.error('Index error');
      // except IndexError:
      return []

    }

    if (stop)
      limit = (stop - (start || 0))

    const queryResults = await this.model.find(findOptions, { orderBy: ordering, limit: limit })

    for (const activity of queryResults.toArray())
      results.push([activity['activityId'], activity])

    return results
  }

  flush() { throw new NotImplementedError() }
  getIndexOf() { throw new NotImplementedError() }
  getBatchInterface() { throw new NotImplementedError() }
}