import { ValueError } from "../errors"
import { datetimeToEpoch, hashCode, hashCodePositive } from "../utils"
import { BaseActivity } from "./BaseActivity"
import { DehydratedActivity } from "./DehydratedActivity"

/**
 * Wrapper class for storing activities
 * Note
 * actorId
 * targetId
 * and objectId are always present
 * actor, target and object are lazy by default
 */
export class Activity extends BaseActivity {

  verb = null
  time = null
  extraContext
  dehydrated
  objectId = null
  actorId = null
  targetId = null
  verbId = null

  /**
   * override default 
   */
  toJSON() {
    return {
      activityId: this.serializationId,
      time: this.time,
      extraContext: this.extraContext,
      objectId: this.objectId,
      actorId: this.actorId,
      targetId: this.targetId,
      verbId: this.verbId
    }
  }

  constructor({
    actor,
    verb,
    object,
    target = null,
    time = null,
    extraContext = null
  }) {
    super()

    // sanitize invalid activity
    if (!verb) // verb writetime is require to purge old data
      throw new Error('This does not seems like a valid activity, verb is required')

    if (!actor && !object && !target)
      throw new Error('This does not seems like a valid activity')


    this.time = time || Date.now() // datetime.datetime.utcnow()

    // this.verb = new VerbClass()
    this._setObjectOrId('verb', verb)
    // # either set .actor or .actorId depending on the data
    this._setObjectOrId('actor', actor)
    this._setObjectOrId('object', object)
    this._setObjectOrId('target', target)


    // # store the extra context which gets serialized
    this.extraContext = extraContext || {}
    this.dehydrated = false
  }

  // returns the dehydrated version of the current activity
  getDehydated() {
    return new DehydratedActivity(this.serializationId)
  }

  __eq__(other) {
    if (!(other instanceof Activity)) {
      const message = `Can only compare to Activity not ${other} of type ${typeof (other)}`
      throw new ValueError(message)
    }
    return this.serializationId == other.serializationId
  }

  __lt__(other) {
    return this.serializationId < other.serializationId
  }

  __hash__() {
    return hashCode(this.serializationId)
  }

  /**
   * beware of js handling large number it will generate scientific notation eg: 1.45e+25
   * represent the id as string
   * collision will occur when multiple activity generated at the same milli second
   * with the same objectId and verbId
   * 
   * serializationId is used to keep items locally sorted and unique
   * (eg. used redis sorted sets' score or cassandra column names)
   * serializationId is also used to select random activities from the feed
   * (eg. remove activities from feeds must be fast operation)
   * for this reason the serializationId should be unique and not change over time
   * eg:
   * activity.serializationId = 1373266755000000000042008
   * 1373266755000 activity creation time as epoch with millisecond resolution
   * 0000000000042 activity left padded objectId (10 digits)
   * 008 left padded activity verb id (3 digits)
   * :returns: int --the serialization id 
   */
  get serializationId() {
    if (!this.time) {
      throw new TypeError('Cant serialize activities without a time')
    }

    // remove all the unhashable key such as :;,
    // convert any string to int any number and truncate the number to fixed size
    // using object id and verb
    // which can be generated repeatedly under any machine
    const milliseconds = (Number(datetimeToEpoch(this.time) * 1000))
    const objectIdPad = hashCodePositive(this.objectId + this.verbId)
      .toString()
      .padStart(10, '0')
    const serializationId = `${milliseconds}${objectIdPad}` // % (milliseconds, this.objectId, this.verb.id)

    return serializationId
  }


  /**
   * Not required
   * DehydratedActivity has serializationId
   * @returns 
   */
  generateSerializationId() {
    if (!this.time) {
      throw new TypeError('Cant serialize activities without a time')
    }

    // remove all the unhashable key such as :;,
    // convert any string to int any number and truncate the number to fixed size
    // using object id and verb
    // which can be generated repeatedly under any machine
    const milliseconds = (Number(datetimeToEpoch(this.time) * 1000))
    const objectIdPad = hashCodePositive(this.objectId + this.verbId)
      .toString()
      .padStart(10, '0')
    const serialization_id_str = `${milliseconds}${objectIdPad}` // % (milliseconds, this.objectId, this.verb.id)
    const serializationId = serialization_id_str
    return serializationId
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

  __repr__() {
    const class_name = this.constructor.name
    const message = `${class_name}(${this.verb.past_tense}) ${this.actorId} ${this.objectId}`
    return message
  }
}
