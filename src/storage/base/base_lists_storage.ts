import { NotImplementedError } from "../../errors"

/**
 * A storage used to simultaneously track data in one or more lists.
 * Data could be either added/removed/get/counted/flushed from one or more of the lists.
 * These operations are executed in an atomic way which guarantees that either
 * the data in all of the selected lists is modified or not.
 * 
 * @example
 *     feed_counters = ListsStorage('user:5')
 *     // # adds simultaneously [1,2,3,4] to unread and [1,2,3] to unseen lists
 *     feed_counters.add(unread=[1,2,3,4], unseen=[1,2,3])
 *     // # adds [5,6] to unread list
 *     feed_counters.add(unread=[5,6])
 *     // # adds [7,8] to unseen list
 *     feed_counters.add(unseen=[7,8])
 *     // # removes simultaneously [5,6] from unread and [1,4] from unseen lists
 *     feed_counters.remove(unread=[5,6], unseen=[1,4])
 *     // # removes [2] from unseen
 *     feed_counters.remove(unseen=[2])
 *     // # removes [1,2] from unread
 *     feed_counters.remove(unread=[1,2])
 *     // # counts simultaneously items in unseen and unread lists
 *     unseen_count, unread_count = feed_counters.count('unseen', 'unread')
 *     // # count items in unseen list
 *     unseen_count = feed_counters.count('unseen')
 *     // # count items in unread list
 *     unread_count = feed_counters.count('unread')
 *     // # returns all unseen and unread items
 *     unseen_items, unread_items = feed_counters.get('unseen', 'unread')
 *     // # returns all items in unseen list
 *     unseen_items = feed_counters.get('unseen')
 *     // # returns all items in unread list
 *     unread_items = feed_counters.get('unread')
 *     // # clears unseen and unread items
 *     feed_counters.flush('unseen', 'unread')
 *     // # clears unseen items
 *     feed_counters.flush('unseen')
 *     // # clears unread items
 *     feed_counters.flush('unread')
 */
export abstract class BaseListsStorage {

  // used to produce a unique key for each list
  keyFormat = (key, list) => `list:${key}:${list}`

  // the maximum amount of items to be stored in each list
  maxLength = null

  // some of the storages like those based on Redis may store the data in other
  // than the original format. In this case this field is used to convert data back.
  data_type = 'string' // str
  base_key

  constructor(key, kwargs) {
    this.base_key = key
    this.keyFormat = kwargs['keyFormat'] || this.keyFormat
    this.maxLength = kwargs['maxLength'] || this.maxLength
    this.data_type = kwargs['data_type'] || this.data_type
  }

  // Provides the key for a given list
  getKey(list_name) {
    return this.keyFormat(this.base_key, list_name)
  }

  /** 
   * Adds items to one or more lists.
   * @example
   *     feed_counters = ListsStorage('user:5')
   *     feed_counters.add(unread=[1,2,3,4], unseen=[1,2,3])
   *     feed_counters.add(unread=[5,6])
   *     feed_counters.add(unseen=[7,8])
   * : kwargs define pairs of list and items to be used for lists modifications
   */
  abstract add(kwargs)

  /*
   * Removes items from one or more lists.
   * @example
   *     feed_counters = ListsStorage('user:5')
   *     feed_counters.remove(unread=[5,6], unseen=[1,4])
   *     feed_counters.remove(unseen=[2])
   *     feed_counters.remove(unread=[1,2])
   * : kwargs define pairs of list and items to be used for lists modifications
   */
  abstract remove(kwargs)

  /*
   * Counts items in one or more lists.
   * @example
   *     feed_counters = ListsStorage('user:5')
   *     unseen_count, unread_count = feed_counters.count('unseen', 'unread')
   *     unseen_count = feed_counters.count('unseen')
   *     unread_count = feed_counters.count('unread')
   * : args define which lists' items to be counted
   */
  abstract count(...args)

  /*
   * Retrieves all items from one or more lists.
   * @example
   *     feed_counters = ListsStorage('user:5')
   *     unseen_items, unread_items = feed_counters.get('unseen', 'unread')
   *     unseen_items = feed_counters.get('unseen')
   *     unread_items = feed_counters.get('unread')
   * : args define which lists' items to be retrieved
   */
  abstract get(...args)

  /*
   * Clears one ore more lists.
   * @example
   *     feed_counters = ListsStorage('user:5')
   *     feed_counters.flush('unseen', 'unread')
   *     feed_counters.flush('unseen')
   *     feed_counters.flush('unread')
   * : args define which lists to be cleared
   */
  abstract flush(args)
}