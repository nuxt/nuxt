import EventEmitter from 'events'

export default class BuilderUIReporter extends EventEmitter {
  constructor() {
    super()
    this.states = []
  }

  onUpdate() {
    this.emit('update')
  }

  allDone() {
    this.states = []
    this.onUpdate()
  }

  done({ statesArray, hasErrors }) {
    if (hasErrors) {
      return this.allDone()
    }

    this.states = statesArray
    this.onUpdate()
  }

  progress({ statesArray }) {
    this.states = statesArray
    this.onUpdate()
  }
}
