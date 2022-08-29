import { register } from "./utils"

// Every activity has a verb and an object.
// Nomenclatura is loosly based on
// http://activitystrea.ms/specs/atom/1.0/#activity.summary
export class Verb {

  id = 0
  infinitive

  /**
   * @deprecated use toString 
   */
  __str__() {
    return this.infinitive
  }

  toString() {
    if (!this.infinitive)
      throw new Error('property infinitive not found')
    return this.infinitive
  }

  serialize(self) {
    const serialized = self.id
    return serialized
  }

}

export class Follow extends Verb {
  static _id = 1
  id = 1
  infinitive = 'follow'
  past_tense = 'followed'
}
register(Follow)


export class Comment extends Verb {
  static _id = 2
  id = 2
  infinitive = 'comment'
  past_tense = 'commented'
}
register(Comment)


export class Love extends Verb {
  static _id = 3
  id = 3
  infinitive = 'love'
  past_tense = 'loved'
}
register(Love)


export class Add extends Verb {
  static _id = 4
  id = 4
  infinitive = 'add'
  past_tense = 'added'
}
register(Add)
