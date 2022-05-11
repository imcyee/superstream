import { faker } from '@faker-js/faker';
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { setupRedisConfig } from '../../../src';
import { CassandraTestManager } from '../../../src/feedManagers/cassandra/CassandraTestManager';
import { registeredManagers } from '../../../src/feedManagers/registerManager';
import { runCassandraMigration } from '../../../src/storage/cassandra/cassandra.migration';
import { setupCassandraConnection } from '../../../src/storage/cassandra/connection';
import { setupTask } from '../../../src/task/setupTask';
import { generateActivity } from '../../utils/generateActivity';
import { wait } from '../../utils/wait';
import { ableToUpdateUserActivity, addUserActivity, defaultTaskTimeout, followUserAndCopyContent, testAbleToFanout, testAbleToRemoveActivitiesForFollower, unfollowAndRemoveContent } from '../managerGeneralTest';

 
// const followers = [
//   faker.datatype.uuid(),
//   faker.datatype.uuid()
// ]
// jest.spyOn(CassandraTestManager.prototype, 'getUserFollowerIds')
//   .mockImplementation(async () => ({
//     'HIGH': followers
//   }));


describe("GenericContainer", () => {
  let container: StartedTestContainer
  let container2: StartedTestContainer
  let setupProps: Awaited<ReturnType<typeof setupTask>>

  beforeAll(async () => {
    // pull the image first
    const promise2 = new GenericContainer("redis:6.2.5")
      .withExposedPorts(6379)
      .start();
    const promise1 = new GenericContainer("cassandra:3.11.0")
      .withExposedPorts(9042) // 7000 for node, 9042 for client
      .start();

    const [c1, c2] = await Promise.all([promise1, promise2])
    container = c1
    container2 = c2

    const redisPort = container2.getMappedPort(6379)
    const redisHost = container2.getHost()
    setupRedisConfig({
      host: redisHost,
      port: redisPort,
    })

    setupCassandraConnection({
      // host: '192.168.0.146',// container.getHost(),
      host: container.getHost(),
      port: container.getMappedPort(9042),
    })

    setupProps = await setupTask({
      port: redisPort,
      host: redisHost
    })

    console.log('managers in here', registeredManagers);
    await runCassandraMigration()

    // task is executed in seperated process
    await wait(2500)
  }, 80000);

  afterAll(async () => {

    // wait for statsd to flush out 
    await wait(2500)
    await setupProps.shutdown()

    await container.stop()
    await container2.stop()
  });



  it("Able to add user activity", async () => {
    const feedManager = new CassandraTestManager({ tasks: setupProps.taskQueues })
    await addUserActivity(feedManager)
  });

  it("Able to fan out activities to follower", async () => {
    const feedManager = new CassandraTestManager({ tasks: setupProps.taskQueues })
    await testAbleToFanout(feedManager)
  }, defaultTaskTimeout);


  it("Able to remove and remove fan out activities to follower", async () => {
    const feedManager = new CassandraTestManager({ tasks: setupProps.taskQueues })
    await testAbleToRemoveActivitiesForFollower(feedManager)
  }, defaultTaskTimeout);

  it("follow user and copy content", async () => {
    const feedManager = new CassandraTestManager({ tasks: setupProps.taskQueues })
    await followUserAndCopyContent(feedManager)
  }, defaultTaskTimeout);


  it("unfollow user and remove copied content", async () => {
    const feedManager = new CassandraTestManager({ tasks: setupProps.taskQueues })
    await unfollowAndRemoveContent(feedManager)
  }, defaultTaskTimeout);

  it("Able to update user activity", async () => { 
    const feedManager = new CassandraTestManager({ tasks: setupProps.taskQueues })
    await ableToUpdateUserActivity(feedManager)
  });
});