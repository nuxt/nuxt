import * as _kit from '@nuxt/kit'
import { createTest, exposeContextToEnv } from '@nuxt/test-utils'

// @ts-ignore type cast
const kit: typeof _kit = _kit.default || _kit

const options = JSON.parse(process.env.NUXT_TEST_OPTIONS || '{}')
const hooks = createTest(options)

export const setup = async () => {
  kit.logger.info('Building Nuxt app...')
  await hooks.setup()
  exposeContextToEnv()
  kit.logger.info('Running tests...')
}

export const teardown = async () => {
  await hooks.afterAll()
}
