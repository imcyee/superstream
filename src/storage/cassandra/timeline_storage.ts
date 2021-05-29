import * as cassandra from 'cassandra-driver'
import { ValueError } from "../../errors"
import { CassandraActivitySerializer } from "../../serializers/cassandra/activity_serializer"
import { BaseTimelineStorage } from "../base"
import { getClient } from "./connection"
import { models } from "./models"

const client = getClient()
const Mapper = cassandra.mapping.Mapper;
const q = cassandra.mapping.q;
const keyspace = 'stream'
const mapper = new Mapper(client, {
  models: {
    'Activity': {
      keyspace: keyspace,
      tables: ['feeds'],
    },
  }
});

export class CassandraTimelineStorage extends BaseTimelineStorage {
  // """
  // A feed timeline implementation that uses Apache Cassandra 2.0 for storage.
  // CQL3 is used to access the data stored on Cassandra via the ORM
  // library CqlEngine.
  // """

  default_serializer_class = CassandraActivitySerializer as any
  insert_batch_size = 100

  model: cassandra.mapping.ModelMapper<any>
  base_model
  column_family_name

  constructor({
    serializer_class = null,
    modelClass = models.Activity,
    ...options
  }) {
    super({
      serializer_class,
      ...options
    })
    this.column_family_name = options['column_family_name']
    this.base_model = modelClass
    this.model = mapper.forModel(modelClass)
  }

  async add_to_storage(
    key,
    activities,
    {
      batch_interface = null,
      kwargs
    }
  ) {
    const changes = []

    for (const model_instance of Object.values(activities)) {
      // @ts-ignore
      model_instance.feed_id = key.toString()
      changes.push(this.model.batching.insert(model_instance))
    }
    const results = await mapper.batch(changes)
    return results.toArray()

  }

  async remove_from_storage(key, activities, batch_interface = null) {
    const changes = []
    for (const activity_id of activities.keys()) {
      changes.push(this.model.batching.remove({ feed_id: key, activity_id: activity_id }))
    }
    await mapper.batch(changes)
  }

  async trim(key, max_length, batch_interface = null) {
    // trim using Cassandra's tombstones black magic
    // retrieve the WRITETIME of the last item we want to keep
    // then delete everything written after that
    // this is still pretty inefficient since it needs to retrieve
    // length amount of items
    // WARNING: since activities created using Batch share the same timestamp
    // trim can trash up to (batch_size - 1) more activities than requested
    const variable = this.base_model === models.Activity
      ? 'verb_id' // must make sure null is not allow to be empty
      : 'group'

    const query = `
      SELECT 
        WRITETIME(${variable}) as wt 
      FROM 
        ${keyspace}.${this.column_family_name} 
      WHERE 
        feed_id=? 
      ORDER BY 
        activity_id DESC 
      LIMIT 
        ?;
    `

    const parameters = [,
      key,
      max_length + 1
    ]

    const results = await client.execute(query, parameters, { prepare: true })

    // # compatibility with both cassandra driver 2.7 and 3.0
    const results_length = results.rowLength

    // length is still within max
    if (results_length < max_length)
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

    const delete_query = `DELETE FROM ${keyspace}.${this.column_family_name} USING TIMESTAMP ? WHERE feed_id=?;`
    const delete_params = [
      trim_ts, // in microseconds
      key
    ]

    await client.execute(delete_query, delete_params, { prepare: true })

  }

  async count(key) {
    const results = (await this.model.find({ feed_id: key })).toArray().length
    return results
  }

  async delete(key) {
    return await this.model.remove({ feed_id: key })
  }

  // @property
  // overwriting parent method
  get serializer() {
    // '''
    // Returns an instance of the serializer class
    // '''
    const serializer_class = this.serializer_class
    const kwargs = {}
    if (this['aggregated_activity_class'])
      kwargs['aggregated_activity_class'] = this.aggregated_activity_class

    const serializer_instance = new serializer_class({
      model: this.model,
      activity_class: this.activity_class,
      ...kwargs
    })
    return serializer_instance
  }

  async contains(key, activity_id) {
    const results = await this.model.find({ feed_id: key, activity_id })
    return results.toArray().length > 0
    // return this.model.objects.filter(feed_id = key, activity_id = activity_id).count() > 0
  }

  async index_of(key, activity_id) {
    const hasActivity = await this.contains(key, activity_id)
    if (!hasActivity)
      throw new ValueError()

    const results = await this.model.find({ feed_id: key, activity_id: q.gt(activity_id) })
    return results.toArray().length
    // return this.model.objects.filter(feed_id = key, activity_id__gt = activity_id).count()
  }

  get_ordering_or_default(ordering_args) {
    var ordering
    if (!ordering_args)
      ordering = { 'activity_id': 'asc' }
    else
      ordering = ordering_args
    return ordering
  }

  async get_nth_item(key, index, ordering_args = null) {
    const ordering = this.get_ordering_or_default(ordering_args)
    const results = (await this.model.find(
      { feed_id: key, },
      { orderBy: ordering, limit: (index + 1) }
    )).toArray()
    return results[index]
  }

  async get_slice_from_storage({
    key,
    start,
    stop,
    filter_kwargs = null,
    ordering_args = null
  }) {
    // '''
    // :returns list: Returns a list with tuples of key,value pairs
    // '''
    const results = []
    var limit = 10 ** 6

    const ordering = this.get_ordering_or_default(ordering_args)

    var findOptions = {} as any;
    findOptions.feed_id = key

    if (filter_kwargs) {
      findOptions = {
        ...findOptions,
        ...filter_kwargs
      }
    }

    try {
      if (start === null || start != 0) {
        const offset_activity_id = await this.get_nth_item(key, start, ordering)
        findOptions = { ...findOptions, activity_id: q.lte(offset_activity_id.activity_id) }
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
      results.push([activity['activity_id'], activity])

    return results
  }
}