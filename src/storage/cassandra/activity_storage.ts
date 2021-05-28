// from stream_framework.storage.base import BaseActivityStorage

import { NotImplementedError } from "../../errors"
import { BaseActivityStorage } from "../base"


export class CassandraActivityStorage extends BaseActivityStorage {

  async get_from_storage(activity_ids, kwargs): Promise<{}> {
    throw new NotImplementedError('Not implemented')
  }
  async add_to_storage(serialized_activities, kwargs) {
    throw new NotImplementedError('Not implemented')
  }
  async remove_from_storage(activity_ids, kwargs) {
    throw new NotImplementedError('Not implemented')
  }
}