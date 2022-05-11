# Notice
This library is still in the early process of porting/developing from [Stream Framework](https://github.com/tschellenbach/Stream-Framework). 

## Help needed
If you wish to help, PR is always welcome.

# Features: 
- Activity Feed, eg: facebook feeds
- Notification

# Usage
testcontainers are used to simulate the redis/cassandra environment
```
import { Manager, setupRedisConfig, Activity, RegisterManager, setupTask } from 'superstream'
import { GenericContainer } from "testcontainers";
import * as faker from 'faker'

/**
 * Extend manager class
 * Test class for manager
 */
@RegisterManager()
export class TestManager extends Manager {
  // override method to getUserFollowerIds
  async getUserFollowerIds() {
    return {
      HIGH: [
        faker.datatype.uuid(),
        faker.datatype.uuid(),
        faker.datatype.uuid(),
        faker.datatype.uuid(),
      ]
    }
  }
}

(async () => {
  // pull Redis image 
  const redisContainer = await new GenericContainer("redis:6.2.5")
    .withExposedPorts(6379)
    .start();

  // storage configuration
  setupRedisConfig({
    host: redisContainer.getHost(),
    port: redisContainer.getMappedPort(6379),
  })

  // task configuration
  const setupProps = await setupTask({
    host: redisContainer.getHost(),
    port: redisContainer.getMappedPort(6379),
  })

  // after storage and task are successfully started
  const managerFeed = new TestManager()
  const userId = faker.datatype.uuid()

  // create activity
  const activity = new Activity({
    actor: `user:${faker.datatype.uuid()}`,
    verb: faker.random.arrayElement([`cinema:book`, 'themepark:go']),
    object: `movie:${faker.datatype.number()}`,
  })
 
  await managerFeed.addUserActivity(userId, activity)

  // get current user feed
  const userFeed = managerFeed.getUserFeed(userId)

  const activities = await userFeed.getItem(0, 5)
  console.log('activities: ', activities);

  // cleanup
  return async () => {
    await setupProps.shutdown()
    await redisContainer.stop()
  }
})()
```
 
# How it works  
![How it works](./docs/res/how_it_works.png "How it works")

# How can you help 
Please see this issue: https://github.com/imcyee/superstream/issues/1
  
# Key concept
## Activity 
an entity that enclose information, actors, context, objects, etc
Best practice - Saves only IDs instead of the whole object to activity and then `re-hydrate` it with your own data. So, if you edit your object, you don't have to edit it in feed.

## Feed
A feed stores a collection of activities. 
Each user can have a few feeds, such as notification feed that store all the notification feed. 
 
## Serializer
Preparing data to be persisted/loaded, Each type of persistence will require a different serializer.
It jobs determine how data is getting translate between api layer and persistence layer.
  
## Storage
Currently supported storages are 
- redis
- cassandra (Partially)
 
### Which persistence storage to use
Redis: https://redis.io/topics/persistence
Pros: easy to work with
Cons: getting more expensive as data grows

(Not fully supported yet)
Cassandra: https://stackoverflow.com/questions/18462530/why-dont-you-start-off-with-a-single-small-cassandra-server-as-you-usually
Pros: cheaper than memory based persistence

### Get started - storage
#### Redis - setup redis config

#### Cassandra - Run migration first

 
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
 
# Running test 
We are using testContainer which run with docker.
If test failed: 
You may have to: 
- Pull neccessary image to run test. Run `npm run test:watch`

# Credit
Stream-Framework [https://github.com/tschellenbach/Stream-Framework] 
 
# Follow user/unfollow user
We will copy every activity that has actorId or targetId of the user being followed.
Same goes for unfollow, all activities with actorId or targetId will be removed from current user feed. 
Please note that: you have to specify `separator` for config.
Because when we are copying data, it will compare userId with the actorId you supplied.
Eg: 'user:123', 'user:customer:123' or '123'
Hence you have to specify the separator for superstream to know how the get the id
Below is example for `user:123`

```
import {setConfig} from 'superstream'

setConfig({
  separator: ":"
})

```
 
# Refillment Guide
All activities queried are id only, rehydration has to be done on your side.
Guide can be founded [here](./doc/refillment).

# Serializer issue
We used data serializer
unlike in python (pickle) or java

in JS we use json.

Here is how we can serialize it if we have to.
https://stackoverflow.com/a/11761533/11497165


# docker-compose
Run `docker-compose build`
Run `docker-compose up`