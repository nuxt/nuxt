import consola from 'consola'
import { buildFixture } from '../../utils/build'

describe('missing-pages-dir', () => {
  buildFixture('missing-pages-dir', (builder) => {
    const { options } = builder.nuxt
    expect(consola.warn).toHaveBeenCalledTimes(1)
    expect(consola.warn).toHaveBeenCalledWith(`No \`${options.dir.pages}\` directory found in ${options.srcDir}. Using the default built-in page.`)
  })
})
