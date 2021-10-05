import { CustomCassandraManager } from "../manager/CustomCassandraManager"
import { CustomRedisManager } from "../manager/CustomRedisManager"

export const getStorageManagerClass = (storageName) => {
  var StorageManagerClass
  switch (storageName) {
    case 'redis':
      StorageManagerClass = CustomRedisManager
      break
    case 'cassandra':
      StorageManagerClass = CustomCassandraManager
      break
  }
  return StorageManagerClass
}