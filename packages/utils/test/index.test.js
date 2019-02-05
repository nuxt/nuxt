import * as Util from '../src'
import * as context from '../src/context'
import * as lang from '../src/lang'
import * as resolve from '../src/resolve'
import * as route from '../src/route'
import * as serialize from '../src/serialize'
import * as task from '../src/task'
import * as timer from '../src/timer'

describe('util: entry', () => {
  test('should export all methods from utils folder', () => {
    expect(Util).toEqual({
      ...context,
      ...lang,
      ...resolve,
      ...route,
      ...serialize,
      ...task,
      ...timer
    })
  })
})
