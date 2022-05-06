
# What is has changed from the source?
- Field ID:

    Stream Framework only support integer ID by default to redis and cassandra.

    This port supports ID with string, such as `User:123` instead of just `123` by default.

- serializationId generator: 

    Each activity is assigned an Unique ID, 

    ## Previously, from stream-framework:
    ```
      activity.serialization_id = 1373266755000000000042008
      1373266755000 activity creation time as epoch with millisecond resolution
      0000000000042 activity left padded object_id (10 digits)
      008 left padded activity verb id (3 digits)
    ```

    ## v0 implementation
    The format is about the same but our id field are not string instead of Int we have to hash it.
    Hence, our collision fate is now base on the hashing function.
    What this does is objectId and verbId are both in string hence we have to hash it to generate an integer
    ```
      // remove all the unhashable key such as :;,
      // convert any string to int any number and truncate the number to fixed size
      // using object id and verb
      // which can be generated repeatedly under any machine
      const milliseconds = (Number(datetimeToEpoch(this.time) * 1000))
      const objectIdPad = hashCodePositive(this.objectId + this.verbId)
        .toString()
        .padStart(10, '0')
      const serializationId = `${milliseconds}${objectIdPad}` // % (milliseconds, this.objectId, this.verb.id)
    ```

    ## v1 implementation
    uuid v1 - simple and almost collision free.

