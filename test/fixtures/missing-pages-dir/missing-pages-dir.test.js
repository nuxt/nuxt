import consola from 'consola'
import { buildFixture } from '../../utils/build'

describe('missing-pages-dir', () => {
  buildFixture('missing-pages-dir', (builder) => {
    const options = builder.nuxt.options
    expect(consola.warn).toHaveBeenCalledTimes(1)
    expect(consola.warn.mock.calls).toMatchObject([
      [{
        message: `No \`${options.dir.pages}\` directory found in ${options.srcDir}.`,
        additional: 'Using the default built-in page.\n',
        additionalStyle: 'yellowBright',
        badge: true
      }]
    ])
  })
})
