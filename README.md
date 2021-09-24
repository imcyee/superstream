# This projection is a direct port of Stream Framework.
Currently is in pre-alpha stage, which is not battle-tested, but the code is translate directly from a production ready source [https://github.com/tschellenbach/Stream-Framework]

# PLRESE READ THIS
This library is currently in the process of porting and developing. This public Github release is to seek help to improve the Port, hence be prepared for the bumby road.

# Features: 
Activity Feed: Example are facebook feeds
Notification
... and any feature you can think of.

# I am currently in need of help.
Yes, I am (shorts of hands). If you wish to help, PR is welcome.

# Get started
``
  import { Manager, setupRedisConfig } from 'superstream'
  import faker from 'faker'

  class CustomManager extends Manager {
      // copy activities to your user's follower
      async getUserFollowerIds(userId) {
          const followerIds = await this.myDatabase.getFollowers(userId)
          return {
            [FanoutPriority.HIGH] : followerIds
          }
      }
  }

  (()=>{
      setupRedisConfig({
        host: 'localhost',
        port: 6379
      })
      const customManager = new CustomManager()

      // user creates an activity
      const newActivity = new Activity({
        actor: `user:${faker.datatype.uuid()}`,
        verb: faker.random.arrayElement([`cinema:book`, 'themepark:go']),
        object: `movie:${faker.datatype.number()}`,
        target: 'cinema:gold_bridge_cinema',
        extraContext: {
          price: 12
        }
      })

      // add to user feed
      await feed.addUserActivity(userId, activity1)

      // get current user feed
      const userFeed = feed.getUserFeed(userId)
      const activities = await userFeed.getItem(0, 5)
  })
``


# What is different?
Field ID:
Stream Framework only support integer ID by default to redis and cassandra.
This port does support ID with string, such as `User:123` instead of just `123` by default.

serializationId generator: 
Each activity is assigned an Unique ID, 
Previously
```
  activity.serialization_id = 1373266755000000000042008
  1373266755000 activity creation time as epoch with millisecond resolution
  0000000000042 activity left padded object_id (10 digits)
  008 left padded activity verb id (3 digits)
```
Currently
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


# How can you help 
- Better id generator
Currently serializationId can be collided if two activity with same verb and object can be collided if both were generated at the same time.
Spec (Not lock and open for changes):
  - No collision,
  - must be sortable, it is used by database to query, should fit for both redis or cassandra. 
  - final has to be int (for querying purposes)

- Better test coverage:
  - unit test for important component such as feed, activity, aggregate
 
- Better e2e test:
  - integration test with database: cassandra and redis

Except the changes specified at [#What is different], if the code doesn't seems right to you, you can always refer back to the source code [https://github.com/tschellenbach/Stream-Framework]

 
# Road map
- [X] Support any type of id (now only support integer, and kinda problematic for string id)
- [X] sorted set support of integer rank
- [] Port aggregate
  - [X] Direct translate
  - [] Test
  - [X] redis
  - [] cassandra
- [] Port manager


# Best practice
Saving only IDs instead to serialize the whole object.

# Top architecture
Nodejs - as api
redis/cassandra for storage

# Terms
Activity - an entity that enclose every information, actors, context, objects, etc
Feed - a feed belongs to someway with collection of activities

# Cassandra 
Run migration first


# Serializer
Preparing data to be persisted.
Persistence dependent


# Storage
Currently supported storages are 
- redis
- cassandra (Partially)


# Feed
Each user can have a few feeds, such as notification feed that store all the notification feed. 


# What To Store
 
Stream allows you to store custom data in your activities. How much data you store in the activities is up to you. Here are a few recommendations:

Always send the foreign_id and time fields. Without "foreign_id" and "time," you won't be able to update activities.

Keep data normalized when possible to avoid complex update flows. Activity fields like actor and object often contain complex objects like users, posts, or articles. Since the data for those objects can be updated, it is better to store a reference (e.g. their ID or URI) and replace them with the full object at read-time.

Store a user id and not the full user object. Otherwise, if someone changes their user image or username, you'll have to update tons of activities.

Attach metadata like tags and categories (if applicable) to your activities. This will help our data-science team optimize your feed personalization algorithms. (available on enterprise plans).

If you're using ranked feeds we recommend storing counts of the likes and comments. That allows you to take those factors into account when sorting feeds.

Activities have a max size. Storing a large amount of text is ok, storing images directly in the activity won't work, you should store the image URL instead.


# Why timeline are saving to activity and timeline
Each activity can be save in different feed, your custom feed, timeline feed, notification feed and etc. Saving a seperate activity can share among all feeds. Think of it as RMDBS normalization, like how we use join, instead of populating every row, which is fast but also waste spaces.


# Serializer 
What is getting translate between api layer and persistence layer


# here is a topic of which persistence to use
Redis: https://redis.io/topics/persistence

Cassandra: https://stackoverflow.com/questions/18462530/why-dont-you-start-off-with-a-single-small-cassandra-server-as-you-usually


# Running test 
We are using testContainer which run with docker.
If test failed: 
You may have to: 
- Pull neccessary image to run test. Run `npm run test:watch`

# Credit
Stream-Framework [https://github.com/tschellenbach/Stream-Framework]
