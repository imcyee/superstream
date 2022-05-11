import { BaseStorage } from "./base_storage"

/**
 * The Activity storage globally stores a key value mapping.
 * This is used to store the mapping between an activityId && the actual
 * activity object.
 * @example
 *     storage = BaseActivityStorage()
 *     storage.addMany(activities)
 *     storage.getMany(activityIds)
 * 
 * The storage specific functions are located in
 * - addToStorage
 * - getFromStorage
 * - removeFromStorage 
 */
export abstract class BaseActivityStorage extends BaseStorage {

  /**
   * addToStorage also update existing activity if found
   * @param serializedActivities 
   * @param opts 
   */
  // addToStorage(serializedActivities, *args, ** opts) {
  // Adds the serialized activities to the storage layer 
  // :param serializedActivities: a dictionary with {id: serializedActivity}
  abstract addToStorage(serializedActivities, opts)

  // Retrieves the given activities from the storage layer
  // :param activityIds: the list of activity ids
  // :returns dict: a dictionary mapping activity ids to activities
  abstract getFromStorage(activityIds, opts) // : Promise<{}>

  // Removes the specified activities
  // :param activityIds: the list of activity ids
  abstract removeFromStorage(activityIds, opts)

  // Gets many activities && deserializes them
  // :param activityIds: the list of activity ids
  async getMany(activityIds, opts?) {
    this.metrics.onFeedRead(this.constructor.name, activityIds?.length)
    const activitiesData = await this.getFromStorage(activityIds, opts)
    return this.deserializeActivities(activitiesData)
  }

  get(activityId, opts) {
    const results = this.getMany([activityId], opts)
    if (!results)
      return null
    else
      return results[0]
  }
  add(activity, opts) {
    return this.addMany([activity], opts)
  }

  // Adds many activities && serializes them before forwarding
  // this to addToStorage 
  // :param activities: the list of activities
  addMany(activities, opts) {
    this.metrics.onFeedWrite(this.constructor.name, activities?.length)
    const serializedActivities = this.serializeActivities(activities) 
    return this.addToStorage(serializedActivities, opts)
  }

  remove(activity, opts) {
    return this.removeMany([activity], opts)
  }

  // Figures out the ids of the given activities && forwards
  // The removal to the removeFromStorage function 
  // :param activities: the list of activities 
  removeMany(activities, opts) {
    this.metrics.onFeedRemove(this.constructor.name, (activities).length)
    var activityIds
    // if (activities && isinstance(activities[0], (six.string_types, six.integer_types, uuid.UUID))) {
    if (activities && (typeof activities[0] === 'string' || typeof activities[0] === 'number')) {
      activityIds = activities
    } else {
      activityIds = Object.keys(this.serializeActivities(activities))
    }
    return this.removeFromStorage(activityIds, opts)
  }
}
