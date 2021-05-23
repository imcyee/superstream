// from stream_framework.utils import get_class_from_string

import { ValueError } from "../errors"
// import { Follow, Verb } from "./base"


const VERB_DICT = {}


export function get_verb_storage() {
  // // from stream_framework import settings
  // if (settings.STREAM_VERB_STORAGE == 'in-memory') {
  //   return VERB_DICT
  // } else {
  //   return get_class_from_string(settings.STREAM_VERB_STORAGE)()
  // }
  return VERB_DICT
}

export function register(verb) {
  // '''
  // Registers the given verb class
  // '''
  // from stream_framework.verbs.base import Verb // circulat dependency
  // if (!(verb.prototype instanceof Verb)) {
  //   throw new ValueError(`${verb} doesnt subclass Verb`)
  // }

  const registered_verb = get_verb_storage()?.[verb._id] || verb
 
  if (registered_verb != verb) {
    throw new ValueError(`cant register verb ${verb} with id ${verb._id} (clashing with verb ${registered_verb})`)
  }

  get_verb_storage()[verb._id] = verb
  console.log('hello');
}

export function get_verb_by_id(verb_id) {
  if (!(typeof verb_id === 'number'))
    throw new ValueError(`please provide a verb id, got ${verb_id}`)

  // throw new ValueError('please provide a verb id, got %r' % verb_id)

  return get_verb_storage()[verb_id]
}