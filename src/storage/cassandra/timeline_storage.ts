import * as cassandra from 'cassandra-driver'
import { ValueError } from "../../errors"
import { CassandraActivitySerializer } from "../../serializers/cassandra/activity_serializer"
import { BaseTimelineStorage } from "../base"
import { getClient } from "./connection"
import { models } from "./models"

const client = getClient()
const UnderscoreCqlToCamelCaseMappings = cassandra.mapping.UnderscoreCqlToCamelCaseMappings;
const Mapper = cassandra.mapping.Mapper;
const q = cassandra.mapping.q;
const keyspace = 'stream'
const mapper = new Mapper(client, {
  models: {
    'Activity': {
      keyspace: keyspace,
      tables: ['feeds'],
      // mappings: new UnderscoreCqlToCamelCaseMappings()
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
    // super(CassandraTimelineStorage, this).__init__(serializer_class, options)
    this.model = mapper.forModel(modelClass)
    // this.model = this.get_model(this.base_model, this.column_family_name)
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

    // const batch = batch_interface || this.get_batch_interface()
    for (const model_instance of Object.values(activities)) {
      // @ts-ignore
      model_instance.feed_id = key.toString()
      console.log('///////');
      console.log(model_instance);
      // batch.batch_insert(model_instance)
      changes.push(this.model.batching.insert(model_instance))
    }
    const results = await mapper.batch(changes)
    return results.toArray()
    // if (!batch_interface) {
    //   batch.execute()
    // }
  }

  async remove_from_storage(key, activities, batch_interface = null) {
    // const batch = batch_interface || this.get_batch_interface()
    // for (const activity_id of activities.keys()) {
    //   this.model(feed_id = key, activity_id = activity_id).batch(batch).delete()
    // }
    // if (!batch_interface) {
    //   batch.execute()
    // }
    const changes = []
    for (const activity_id of activities.keys()) {
      changes.push(this.model.batching.remove({ feed_id: key, activity_id: activity_id }))
      // this.model(feed_id = key, activity_id = activity_id).batch(batch).delete()
    }
    await mapper.batch(changes)
  }

  async trim(key, length, batch_interface = null) {
    // trim using Cassandra's tombstones black magic
    // retrieve the WRITETIME of the last item we want to keep
    // then delete everything written after that
    // this is still pretty inefficient since it needs to retrieve
    // length amount of items
    // WARNING: since activities created using Batch share the same timestamp
    // trim can trash up to (batch_size - 1) more activities than requested

    // const query = "SELECT WRITETIME(%s) as wt FROM %s.%s WHERE feed_id='%s' ORDER BY activity_id DESC LIMIT %s;"
    // const query = "SELECT WRITETIME(?) as wt FROM ?.? WHERE feed_id=? ORDER BY activity_id DESC LIMIT ?;"
    const query = "SELECT WRITETIME(feed_id) as wt FROM ?.? WHERE feed_id=? ORDER BY activity_id DESC LIMIT ?;"
    // const trim_col = [c for c in this.model._columns.keys() if c not in this.model._primary_keys.keys()][0]
    const parameters = [
      // trim_col,
      keyspace, // this.model._get_keyspace(),
      this.column_family_name,
      key,
      length + 1
    ]

    // const results = execute(query % parameters)
    const results = await client.execute(query, parameters)

    // # compatibility with both cassandra driver 2.7 and 3.0
    // const results_length = results['current_rows']
    //   ? results.current_rows.length
    //   : results.length
    const results_length = results.rowLength
    if (results_length < length) {
      return
    }
    const trim_ts = (results[-1]['wt'] + results[-2]['wt']) // 2
    // const delete_query = "DELETE FROM %s.%s USING TIMESTAMP %s WHERE feed_id='%s';"
    const delete_query = "DELETE FROM ?.? USING TIMESTAMP ? WHERE feed_id=?;"
    const delete_params = [
      keyspace, //this.model._get_keyspace(), 
      this.column_family_name,
      trim_ts,
      key
    ]


    // execute(delete_query % delete_params)
    await client.execute(delete_query, delete_params)
  }

  async count(key) {
    const results = (await this.model.find({ feed_id: key })).toArray().length
    return results
  }

  async delete(key) {
    return await this.model.remove({ feed_id: key })
  }

  // // @classmethod
  // static get_model(cls, base_model, column_family_name) {
  //   // '''
  //   // Creates an instance of the base model with the table_name (column family name)
  //   // set to column family name
  //   // :param base_model: the model to extend from
  //   // :param column_family_name: the name of the column family
  //   // '''
  //   return factor_model(base_model, column_family_name)
  // }

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

  // get_batch_interface() {
  //   return new Batch(batch_size = this.insert_batch_size, atomic_inserts = False)
  // }

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
    // return this.model.objects.filter(feed_id = key).order_by(* ordering).limit(index + 1)[index]
  }

  // get_columns_to_read(query) {
  //   var columns = this.model._columns.keys()
  //   const deferred_fields = query['defer_fields'] || []
  //   query['_defer_fields'] = []
  //   columns = [c for c in columns if c not in deferred_fields]
  //   // # Explicitly set feed_id as column because it is deferred in new
  //   // # versions of the cassandra driver.
  //   return list(set(columns + ['feed_id']))
  // }

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

    // var query =  this.model.objects.filter(feed_id = key)
    if (filter_kwargs) {
      findOptions = {
        ...findOptions,
        ...filter_kwargs
      }
      // query = query.filter(** filter_kwargs)
    }

    try {
      if (!start || start !== 0) {
        const offset_activity_id = await this.get_nth_item(key, start, ordering)
        console.log(offset_activity_id);
        console.log(offset_activity_id.activity_id);
        findOptions = { ...findOptions, activity_id: q.lte(offset_activity_id.activity_id) }
        // query = query.filter(activity_id__lte = offset_activity_id.activity_id)
      }
    } catch (err) {
      console.error(err);
      console.error('Index error');
      // except IndexError:
      return []

    }

    if (stop) {
      limit = (stop - (start || 0))
    }

    // const cols = this.get_columns_to_read(query)
    console.log(findOptions);
    const queryResults = await this.model.find(findOptions, { orderBy: ordering, limit: limit })
    console.log(queryResults);
    // for (const values of query.values_list(* cols).order_by(* ordering).limit(limit)) {
    for (const activity of queryResults.toArray()) {
      // const activity = dictZip(zip(cols, values))
      results.push([activity['activity_id'], activity])
    }
    return results
  }
}