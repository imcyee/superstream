import faker from '@faker-js/faker'
import { Activity } from '../../src/activity/Activity'

export const generateActivity = (opts = {}) => {
  return new Activity({
    actor: `user:${faker.datatype.uuid()}`,
    verb: faker.helpers.arrayElement([`cinema:book`, 'themepark:go']),
    object: `movie:${faker.datatype.number()}`,
    ...opts
  })
}