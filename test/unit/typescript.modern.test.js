import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
import { loadFixture, Nuxt, Builder, BundleBuilder } from '../utils'

jest.mock('fork-ts-checker-webpack-plugin')

describe('typescript modern', () => {
  let nuxt

  beforeAll(async () => {
    process.env.NUXT_TS = 'true'
    const options = await loadFixture('typescript')
    nuxt = new Nuxt(Object.assign(options, { modern: true }))
    await new Builder(nuxt, BundleBuilder).build()
    delete process.env.NUXT_TS
  })

  test('fork-ts-checker-webpack-plugin', () => {
    expect(ForkTsCheckerWebpackPlugin).toHaveBeenCalledTimes(1)
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
