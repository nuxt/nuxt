import { join } from 'node:path'
import PostcssConfig from '../src/utils/postcss'

describe('webpack: postcss', () => {
  const getConfigWithPostcssConfig = config =>
    new PostcssConfig({
      options: {
        dev: false,
        srcDir: join(__dirname),
        rootDir: join(__dirname),
        modulesDir: []
      },
      nuxt: {
        resolver: {
          requireModule: plugin => opts => [plugin, opts]
        }
      },
      buildOptions: {
        postcss: config
      }
    })

  test('should have the right default configuration', () => {
    // Use the default postcss config: stage 2
    // https://cssdb.org/#staging-process
    const pluginConfig = Object.fromEntries(
      getConfigWithPostcssConfig({ postcssOptions: {} }).config().postcssOptions.plugins
    )
    expect(pluginConfig).toMatchInlineSnapshot(`
      {
        "cssnano": {
          "preset": [
            "default",
            {
              "minifyFontValues": {
                "removeQuotes": false,
              },
            },
          ],
        },
        "postcss-import": {
          "resolve": [Function],
        },
        "postcss-preset-env": {},
        "postcss-url": {},
      }
    `)
  })
  test('can pass a function through', () => {
    // Use the default postcss config: stage 2
    // https://cssdb.org/#staging-process
    const options = getConfigWithPostcssConfig({ postcssOptions: () => ({ preset: { stage: 2 } }) }).config().postcssOptions
    expect(typeof options).toBe('function')
  })
})
