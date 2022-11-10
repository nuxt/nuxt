import { createTest, exposeContextToEnv } from '@nuxt/test-utils'

const hooks = createTest(JSON.parse(process.env.NUXT_TEST_OPTIONS || '{}'))

export const setup = async () => {
  await hooks.setup()
  exposeContextToEnv()
}

export const teardown = async () => {
  await hooks.afterAll()
}
