# Spec
## Serialization id
[x] sortable; able to query from database by order of asc/desc

[x] comparable; activity use serializationId to compare rough creation period between two activity

[ ] able to generate large amount of unique id throughout multiple instance without collision

[ ] supported by database: cassandra and redis


## Implementation 
time uuid 36 character - supported by cassandra

serializationId consists of `[predictable part][random part]`
eg: 1651240223100 (epoch in millis) + 0000012345 = 16512402231000000012345
23number

`[predictable part]` is time stamp in milli second

`[random part]` is concatenation `objectId` and `verbId`
Hence this also require `objectId` and `verbId` to be `NonNull`
And objectId and verbId are in string form, hence, conversion from alphabet 
to number is required.
Random part has about 10digits, which will pad start with `0` 