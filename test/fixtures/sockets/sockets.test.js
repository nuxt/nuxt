import { buildFixture } from '../../utils/build'

describe.posix('unix socket', () => {
  buildFixture('sockets')
})
