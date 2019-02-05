import WarnFixPlugin from '../../packages/webpack/src/plugins/warnfix'
import { loadFixture, Nuxt, Builder, BundleBuilder } from '../utils'

jest.mock('../../packages/webpack/src/plugins/warnfix')

describe('times create of WarnFixPlugin', () => {
  let nuxt
  const createNuxtInstance = async (ignoreNotFoundWarnings) => {
    const overrides = {
      build: { typescript: { ignoreNotFoundWarnings } }
    }

    const options = await loadFixture('typescript', overrides)
    nuxt = new Nuxt(Object.assign(options, { _typescript: { build: true } }))
    await new Builder(nuxt, BundleBuilder).build()

    return nuxt
  }

  beforeEach(() => WarnFixPlugin.mockClear())

  describe('disabled ignoreNotFoundWarnings', () => {
    test('the number of calls is correct', async () => {
      nuxt = await createNuxtInstance(false)

      // called by client, server and modern instances
      expect(WarnFixPlugin).toHaveBeenCalledTimes(3)
    })
  })

  describe('enabled ignoreNotFoundWarnings', () => {
    test('the number of calls is correct', async () => {
      nuxt = await createNuxtInstance(true)

      // called by client, server and modern instances x 2
      expect(WarnFixPlugin).toHaveBeenCalledTimes(6)
    })
  })

  afterEach(async () => { await nuxt.close() })
})
