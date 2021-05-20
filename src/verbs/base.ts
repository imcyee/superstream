class Verb {

  // '''
  // Every activity has a verb and an object.
  // Nomenclatura is loosly based on
  // http://activitystrea.ms/specs/atom/1.0/#activity.summary
  // '''
  id = 0

  __str__(self) {
    return self.infinitive
  }

  serialize(self) {
    const serialized = self.id
    return serialized
  }

}

class Follow {
  id = 1
  infinitive = 'follow'
  past_tense = 'followed'
}
register(Follow)


class Comment {
  id = 2
  infinitive = 'comment'
  past_tense = 'commented'
}
register(Comment)


class Love {
  id = 3
  infinitive = 'love'
  past_tense = 'loved'
}
register(Love)


class Add extends Verb {
  id = 4
  infinitive = 'add'
  past_tense = 'added'
}
register(Add)
