# Refillment Guide
All activities queried are reference only, hence it is required to refill your activity before sending to client.

Payload is in the form of: 
```
{
  actorId: 'user:asd123-xczc-asdasd-zxczxc'
  verbId:'purchase:gift:4',
  objectId:'ticket:2',
  targetId:'user:baxf-xczc-asdasd-asdzxc',
  context: {
    price: 23,
    placeId: 3
  }
}
```

You can refill it with batch query loader.
For pg rdbms: 

- for a list of 10 activities
- First go through the prefix of value of activity field
- store the prefix value to an object list key.
```
{
  user: [
    "asd123-xczc-asdasd-zxczxc",
    "baxf-xczc-asdasd-asdzxc"
  ],
  ticket: [
    2
  ],
}
```
then query database with above array, you will need fewer database access to refill your activity instead of query it one by one.

then, replace your activity reference with queried data.


Your max query will be number of entity in your activity,


[dateloader](https://github.com/graphql/dataloader) of facebook 
```
import DataLoader from 'dataloader'
import faker from 'faker'
 
// dataloader stub
const myBatchGenericGet = async (keys) => {
  return keys.map(key => ({ id: key }))
}
const genericLoader = new DataLoader(keys => myBatchGenericGet(keys))

// fake data
const getUserWithPrefix = () => {
  return `${faker.random.arrayElement(userPrefix)}:${faker.datatype.uuid()}`
}
// fake data
const getObjectWithPrefix = () => {
  return `${faker.random.arrayElement(objectPrefix)}:${faker.datatype.uuid()}`
}
// fake data
const getVerbWithPrefix = () => {
  return `${faker.random.arrayElement(verbPrefix)}:${faker.datatype.number()}`
}
// fake activity data
const createActivityStub = (props?) => {
  // could have prefix
  return {
    actorId: getUserWithPrefix(),
    verbId: getVerbWithPrefix(),
    targetId: getUserWithPrefix(),
    objectId: getObjectWithPrefix(),
    ...props
  }
}

// resolve array of object promise
// credit: https://stackoverflow.com/questions/45022279/dealing-with-an-array-of-objects-with-promises
function promiseAllProps(arrayOfObjects) {
  let datum = [];
  let promises = [];

  arrayOfObjects.forEach(function (obj, index) {
    Object.keys(obj).forEach(function (prop) {
      let val = obj[prop];
      // if it smells like a promise, lets track it
      if (val && val.then) {
        promises.push(val);
        // and keep track of where it came from
        datum.push({ obj: obj, prop: prop });
      }
    });
  });

  return Promise.all(promises).then(function (results) {
    // now put all the results back in original arrayOfObjects in place of the promises
    // so now instead of promises, the actaul values are there
    results.forEach(function (val, index) {
      // get the info for this index
      let info = datum[index];
      // use that info to know which object and which property this value belongs to
      info.obj[info.prop] = val;
    });
    // make resolved value be our original (now modified) array of objects
    return arrayOfObjects;
  });
}


const numArray = 5
const activities = Array(numArray).fill(1).map(() => {
  return createActivityStub()
})

const promises = []
const filledActivity = activities.map((a) => {
  const filled = {} as any
  for (const [key, value] of Object.entries<string>(a)) {

    // you may want to skip context since 
    // we don't know anything about your context 
    // below method might not work 
    // as how you intented so we skip it
    if(key === 'context')
      filled[key] = value


    const splitted = value.split(':') 
    const id = splitted[splitted.length - 1]
    const promise = genericLoader.load(id)
    filled[key] = promise 
    // promises.push(promise)
  }
  return filled
})
 
// await Promise.all(promises)

const resolvedActivities = await promiseAllProps(filledActivity)
console.log('resolvedActivities', resolvedActivities);
```


or without dataloader: 
```
const activities = await userFeed.getItem(0,10)

const queryObject = {} // in the form of {user: ['id', 'id', 'id'], ticket: [...], ...}

activities.forEach((activity)=>{

  for(const [key,value] of Object.entries(activity)){
    if(key === 'context)
      return // require own implementation 
     
    const split = value.split(':')
    const id = split.at(-1) // eg: '123' <- userId
    const keyField = split.at(0) // eg: 'user'

    if(!queryObject[keyField])
      queryObject[keyField] = []

    queryObject[keyField].push(id)
  }

})


// my model map
// YOUR DB ACCESS MODEL 
const modelMap = {
  user: {
    key: 'userId',
    model: UserModel
  },
  ticket: {
    key: 'id',
    model: TicketModel
  },
}

const promises = []
const keyArray = []
for(const [key,value] of Object.entries(queryObject)){
  // YOUR DB QUERY
  const singlePromise = modelMap[key].model.queryWhereIn(value)
  keyArray.push(key) // for remapping key to db results
  promises.push(singlePromise)
}

const results = await Promise.all(promises) // results in array of data array

const mappedResults = {}
keyArray.forEach((key, i)=>{
  mappedResults[key] = results[i]
})

// refillment
const refilledActivities = activities.map(activity=>{
  const refilledActivity = {}
  for(const [key,value] of Object.entries(activity)){ 
    const split = value.split(':')
    const id = split.at(-1) // eg: '123' <- 
    userId
    const keyField = split.at(0) // eg: 'user'

    const modelDBKey = modelMap[key].key
    const found = mappedResults[keyField].find((data)=>{
      return data[modelKey] === id
    })

    refilledActivity[key] = found
  }

  return filledActivity
})


```
