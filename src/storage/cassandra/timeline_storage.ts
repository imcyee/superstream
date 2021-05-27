// from __future__ import division
// import stream_framework.storage.cassandra.monkey_patch
// from cassandra.query import SimpleStatement
// from cassandra.cqlengine.connection import get_session
// from cassandra.cqlengine.connection import execute
// from cassandra.cqlengine.query import BatchQuery
// from stream_framework.storage.base import BaseTimelineStorage
// from stream_framework.storage.cassandra import models
// from stream_framework.serializers.cassandra.activity_serializer import CassandraActivitySerializer
// from stream_framework.utils import memoized
// import logging

import zip from "lodash/zip"
import { ValueError } from "../../errors"
import { CassandraActivitySerializer } from "../../serializers/cassandra/activity_serializer"
import { dictZip } from "../../utils"
import { BaseTimelineStorage } from "../base"
import { getClient } from "./connection"


const client = getClient()


// logger = logging.getLogger(__name__)


class Batch extends BatchQuery {
  // '''
  // Performs a batch of insert queries using async connections
  // '''

  instances
  _batch

  constructor() {
    super()
    this.instances = []
    this._batch = BatchQuery()
  }

  batch_insert(model_instance) {
    this.instances.append(model_instance)
  }

  __enter__() {
    return this
  }

  add_query(query) {
    this._batch.add_query(query)
  }

  add_callback(fn, kwargs) {
    throw new TypeError('not supported')
  }

  execute() {
    const promises = []
    const session = get_session()
    for (const instance of this.instances) {
      const query = instance.__dmlquery__(instance.__class__, instance)
      query.batch(this._batch)
      query.save()
    }
    for (const query of this._batch.queries) {
      const statement = SimpleStatement(str(query))
      const params = query.get_context()
      promises.append(session.execute_async(statement, params))
    }
    return [r.result() for r in promises]
  }
  __exit__(exc_type, exc_val, exc_tb) {
    this.execute()
  }
}

// @memoized
function factor_model(base_model, column_family_name) {
  const camel_case = column_family_name.split('_').map((s: string) => s.toUpperCase()).join('')
  // const camel_case = ''.join([s.capitalize()  for s in column_family_name.split('_')])
  const class_name = `${camel_case}FeedModel` // % camel_case
  return type(class_name, (base_model,), { '__table_name__': column_family_name })
}

class CassandraTimelineStorage extends BaseTimelineStorage {

  // """
  // A feed timeline implementation that uses Apache Cassandra 2.0 for storage.
  // CQL3 is used to access the data stored on Cassandra via the ORM
  // library CqlEngine.
  // """

  // // from stream_framework.storage.cassandra.connection import setup_connection
  // setup_connection()

  default_serializer_class = CassandraActivitySerializer
  insert_batch_size = 100

  model
  base_model
  column_family_name

  constructor(
    serializer_class = null,
    modelClass = models.Activity,
    options
  ) {
    super()
    this.column_family_name = options.pop('column_family_name')
    this.base_model = modelClass
    super(CassandraTimelineStorage, this).__init__(serializer_class, options)
    this.model = this.get_model(this.base_model, this.column_family_name)
  }

  async add_to_storage(
    key,
    activities,
    batch_interface = null,
    kwargs) {
    const batch = batch_interface || this.get_batch_interface()
    for (const model_instance of activities.values()) {
      model_instance.feed_id = key.toString()
      batch.batch_insert(model_instance)
    }
    if (!batch_interface) {
      batch.execute()
    }
  }

  remove_from_storage(key, activities, batch_interface = null) {
    const batch = batch_interface || this.get_batch_interface()
    for (const activity_id of activities.keys()) {
      this.model(feed_id = key, activity_id = activity_id).batch(batch).delete()
    }
    if (!batch_interface) {
      batch.execute()
    }
  }

  trim(key, length, batch_interface = null) {
    // '''
    // trim using Cassandra's tombstones black magic
    // retrieve the WRITETIME of the last item we want to keep
    // then delete everything written after that

    // this is still pretty inefficient since it needs to retrieve
    // length amount of items

    // WARNING: since activities created using Batch share the same timestamp
    // trim can trash up to (batch_size - 1) more activities than requested

    // '''
    // const query = "SELECT WRITETIME(%s) as wt FROM %s.%s WHERE feed_id='%s' ORDER BY activity_id DESC LIMIT %s;"
    const query = "SELECT WRITETIME(?) as wt FROM ?.? WHERE feed_id=? ORDER BY activity_id DESC LIMIT ?;"
    const trim_col = [c for c in this.model._columns.keys() if c not in this.model._primary_keys.keys()][0]
    const parameters = (
      trim_col,
      this.model._get_keyspace(),
      this.column_family_name,
      key,
      length + 1
    )
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
    const delete_params = (this.model._get_keyspace(), this.column_family_name, trim_ts, key)
    // execute(delete_query % delete_params)
    await client.execute(delete_query, delete_params)
  }

  count(key) {
    return this.model.objects.filter(feed_id = key).count()
  }

  delete(key) {
    this.model.objects.filter(feed_id = key).delete()
  }

  // @classmethod
  static get_model(cls, base_model, column_family_name) {
    // '''
    // Creates an instance of the base model with the table_name (column family name)
    // set to column family name
    // :param base_model: the model to extend from
    // :param column_family_name: the name of the column family
    // '''
    return factor_model(base_model, column_family_name)
  }

  // @property
  get serializer() {
    // '''
    // Returns an instance of the serializer class
    // '''
    const serializer_class = this.serializer_class
    const kwargs = {}
    if (this['aggregated_activity_class'])
      kwargs['aggregated_activity_class'] = this.aggregated_activity_class
    const serializer_instance = serializer_class(
      this.model,
      this.activity_class,
      kwargs
    )
    return serializer_instance
  }

  get_batch_interface() {
    return new Batch(batch_size = this.insert_batch_size, atomic_inserts = False)
  }

  contains(key, activity_id) {
    return this.model.objects.filter(feed_id = key, activity_id = activity_id).count() > 0
  }

  index_of(key, activity_id) {
    if (!this.contains(key, activity_id))
      throw new ValueError()
    return this.model.objects.filter(feed_id = key, activity_id__gt = activity_id).count()
  }

  get_ordering_or_default(ordering_args) {
    var ordering
    if (!ordering_args)
      ordering = ('-activity_id', )
    else
      ordering = ordering_args
    return ordering
  }

  get_nth_item(key, index, ordering_args = null) {
    const ordering = this.get_ordering_or_default(ordering_args)
    return this.model.objects.filter(feed_id = key).order_by(* ordering).limit(index + 1)[index]
  }

  get_columns_to_read(query) {
    var columns = this.model._columns.keys()
    const deferred_fields = query['defer_fields'] || []
    query['_defer_fields'] = []
    columns = [c for c in columns if c not in deferred_fields]
    // # Explicitly set feed_id as column because it is deferred in new
    // # versions of the cassandra driver.
    return list(set(columns + ['feed_id']))
  }

  async get_slice_from_storage(key, start, stop, filter_kwargs = null, ordering_args = null) {
    // '''
    // :returns list: Returns a list with tuples of key,value pairs
    // '''
    const results = []
    var limit = 10 ** 6

    const ordering = this.get_ordering_or_default(ordering_args)

    var query = this.model.objects.filter(feed_id = key)
    if (filter_kwargs)
      query = query.filter(** filter_kwargs)

    try {
      if (!start || start !== 0) {
        const offset_activity_id = this.get_nth_item(key, start, ordering)
        query = query.filter(activity_id__lte = offset_activity_id.activity_id)
      }
    } catch (err) {

      except IndexError:
      return []

    }

    if (stop) {
      limit = (stop - (start || 0))
    }

    const cols = this.get_columns_to_read(query)
    for (const values of query.values_list(* cols).order_by(* ordering).limit(limit)) {
      const activity = dictZip(zip(cols, values))
      results.append([activity['activity_id'], activity])
    }
    return results
  }
}