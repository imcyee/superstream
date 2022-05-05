import { CassandraManager } from "./cassandra/CassandraManager";
import { CassandraTestManager } from "./cassandra/CassandraTestManager";
import { RedisManager } from "./redis/RedisManager";
import { RedisTestManager } from "./redis/RedisTestManager";


export const managerRegistration = {
  CassandraManager,
  RedisManager,
  RedisTestManager,
  CassandraTestManager
}