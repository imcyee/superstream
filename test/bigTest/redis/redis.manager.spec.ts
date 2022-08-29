import { GenericContainer, StartedTestContainer } from "testcontainers";
import { RedisTestManager } from '../../../src/feedManagers/redis/RedisTestManager';
import { setupRedisConfig } from "../../../src/storage/redis/connection";
import { setupTask } from '../../../src/task/setupTask';
import { wait } from '../../utils/wait';
import { ableToUpdateUserActivity, addUserActivity, defaultTaskTimeout, followUserAndCopyContent, testAbleToFanout, testAbleToRemoveActivitiesForFollower, unfollowAndRemoveContent } from '../managerGeneralTest';
 
describe("GenericContainer", () => {
  let container: StartedTestContainer;
  let setupProps: Awaited<ReturnType<typeof setupTask>>

  beforeAll(async () => {
    container = await new GenericContainer("redis:6.2.5")
      .withExposedPorts(6379)
      .start();
    const redisPort = container.getMappedPort(6379)
    const redisHost = container.getHost()
    setupRedisConfig({
      host: redisHost,
      port: redisPort,
    })
    setupProps = await setupTask({
      host: redisHost,
      port: redisPort,
    })

  }, 50000);

  afterAll(async () => {
    // wait for statsd to flush out 
    await wait(2500)
    await setupProps.shutdown()
    await container.stop();
  });

  it("Able to add user activity", async () => {
    const feedManager = new RedisTestManager({ tasks: setupProps.taskQueues })
    await addUserActivity(feedManager)
  });

  it("Able to fan out activities to follower", async () => {
    const feedManager = new RedisTestManager({ tasks: setupProps.taskQueues })
    await testAbleToFanout(feedManager)
  }, defaultTaskTimeout);


  it("Able to remove and remove fan out activities to follower", async () => {
    const feedManager = new RedisTestManager({ tasks: setupProps.taskQueues })
    await testAbleToRemoveActivitiesForFollower(feedManager)
  }, defaultTaskTimeout);

  it("follow user and copy content", async () => {
    const feedManager = new RedisTestManager({ tasks: setupProps.taskQueues })
    await followUserAndCopyContent(feedManager)
  }, defaultTaskTimeout);


  it("unfollow user and remove copied content", async () => {
    const feedManager = new RedisTestManager({ tasks: setupProps.taskQueues })
    await unfollowAndRemoveContent(feedManager)
  }, defaultTaskTimeout);

  it("Able to update user activity", async () => { 
    const feedManager = new RedisTestManager({ tasks: setupProps.taskQueues })
    await ableToUpdateUserActivity(feedManager)
  });
 
});