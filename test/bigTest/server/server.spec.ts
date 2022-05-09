import faker from '@faker-js/faker'
import request from 'supertest'
import { startServer } from '../../../server/server'
import { wait } from '../../utils/wait';

const version = "v1"


describe('server', () => {
  var app: Express.Application

  beforeAll(async () => {
    app = await startServer('redis')
  })

  it('server', async () => {
    const userId = faker.datatype.uuid()
    await request(app)
      .post(`/${version}/feeds`)
      .query({ userId })
      .send({
        actorId: faker.datatype.uuid(),
        verbId: faker.datatype.uuid(),
        objectId: faker.datatype.uuid(),
        targetId: faker.datatype.uuid(),
        time: new Date().getTime(),
        // context
      })
      .set('Accept', 'application/json')
      .expect(200)
    await wait(10000)

    const response = await request(app)
      .get(`/${version}/feeds`)
      .query({
        userId,
        offset: 0,
        limit: 5
      })
      .set('Accept', 'application/json')
      .expect(200)
    console.log(response.body);
    expect(response.body.length).toEqual(1);
  }, 20000)
})