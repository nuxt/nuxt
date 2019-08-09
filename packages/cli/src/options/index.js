import common from './common'
import server from './server'
import locking from './locking'

export {
  common,
  server,
  locking
}

export default {
  ...common,
  ...server,
  ...locking
}
