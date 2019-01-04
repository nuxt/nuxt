import { buildFixture } from '../../utils/build'

process.env.NUXT_TS = 'true'
buildFixture('typescript')
delete process.env.NUXT_TS
