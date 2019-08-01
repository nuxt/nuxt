import * as Util from '../src'
import * as context from '../src/context'
import * as lang from '../src/lang'
import * as locking from '../src/locking'
import * as resolve from '../src/resolve'
import * as route from '../src/route'
import * as serialize from '../src/serialize'
import * as task from '../src/task'
import * as timer from '../src/timer'
import * as cjs from '../src/cjs'
import * as modern from '../src/modern'
import * as constants from '../src/constants'

describe('util: entry', () => {
  test('should export all methods from utils folder', () => {
    expect(Util).toEqual({
      ...context,
      ...lang,
      ...locking,
      ...resolve,
      ...route,
      ...serialize,
      ...task,
      ...timer,
      ...cjs,
      ...modern,
      ...constants
    })
  })
})
