import { v1 as uuid } from 'uuid'
import { ValueError } from "../errors"
import { hashCode } from "../utils"
import { BaseActivity } from "./base/BaseActivity"
import { DehydratedActivity } from "./DehydratedActivity"


/**
 * Wrapper class for storing activities
 * Note
 * actorId, targetId  & objectId are always present
 * actor, target and object are lazy by default
 */
export class Activity extends BaseActivity {

  verb = null
  time = null
  context
  dehydrated: boolean
  objectId: string = null
  actorId: string = null
  targetId: string = null
  verbId: string = null
  serializationId: string // uuid

  constructor({
    serializationId = null,
    actorId = null,
    objectId = null,
    targetId = null,
    verbId = null,
    actor = null,
    verb = null,
    object = null,
    target = null,
    time = null,
    context = null
  }) {
    super()

    console.log(
      serializationId,
      actorId,
      objectId,
      targetId,
      verbId,
      actor,
      verb,
      object,
      target,
      time,
      context

    );

    // sanitize invalid activity
    if (!verb && !verbId) // verb writetime is require to purge old data
      throw new Error('This does not seems like a valid activity, verb is required')

    if ((!actor && !actorId) || (!object && !objectId)
      // && !(target || targetId)
    )
      throw new Error('This does not seems like a valid activity')

    this.serializationId = serializationId
      ? serializationId
      : uuid()

    this.time = time || Date.now() // datetime.datetime.utcnow()

    // id takes precedence to object
    // this.verb = new VerbClass()
    this._setObjectOrId('verb', verbId ?? verb)
    // # either set .actor or .actorId depending on the data
    this._setObjectOrId('actor', actorId ?? actor)
    this._setObjectOrId('object', objectId ?? object)
    this._setObjectOrId('target', targetId ?? target)


    // # store the extra context which gets serialized
    this.context = context || {}
    this.dehydrated = false
  }

  // returns the dehydrated version of the current activity
  getDehydated() {
    return new DehydratedActivity(this.serializationId)
  }

  isEqual(other) {
    if (!(other instanceof Activity)) {
      const message = `Can only compare to Activity not ${other} of type ${typeof (other)}`
      throw new ValueError(message)
    }
    return this.serializationId == other.serializationId
  }

  islessThan(other) {
    return this.serializationId < other.serializationId
  }

  __hash__() {
    return hashCode(this.serializationId)
  }

  /**
   * set id to `field`_id  
   */
  private _setObjectOrId(field, objectOrId) {
    const idField = `${field}Id`
    if (Number.isInteger(objectOrId) || typeof objectOrId === 'string') {
      this[idField] = objectOrId
    } else if (!objectOrId) {
      this[field] = null
      this[idField] = null
    } else {
      if (!objectOrId.id)
        throw new Error(`Missing ID for field: ${field}`)
      this[field] = objectOrId
      this[idField] = objectOrId.id
    }
  }

  /**
   * 
   * @example invocation
   * - Serialization for task
   * - console.log(activity)
   * @returns 
   */
  toJSON() {
    return {
      serializationId: this.serializationId,
      time: this.time,
      context: this.context,
      objectId: this.objectId,
      actorId: this.actorId,
      targetId: this.targetId,
      verbId: this.verbId
    }
  }

  // /**
  //  * Inspect only part of the data instead of all the noise
  //  * @example
  //  * call `console.log(util.inspect(my_object));` || `console.log(my_object);` to inspect the data
  //  */
  // [util.inspect.custom]() {
  //   const class_name = this.constructor.name
  //   //    const message = `${class_name}(${this.verb.past_tense}) ${this.actorId} ${this.objectId}`
  //   const message = `${class_name}(${this.verbId}) ${this.actorId} ${this.objectId}`

  //   return message
  // }
}
