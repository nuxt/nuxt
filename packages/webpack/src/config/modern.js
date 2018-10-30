import clone from 'lodash/clone'
import WebpackClientConfig from './client'

export default class WebpackModernConfig extends WebpackClientConfig {
  constructor(builder) {
    super(builder, { name: 'modern', isServer: false, isModern: true })
  }

  getBabelOptions() {
    const options = clone(this.options.build.babel)

    options.presets = [
      [
        require.resolve('@nuxt/babel-preset-app'),
        {
          modern: true
        }
      ]
    ]

    return options
  }

  output() {
    const output = super.output()
    const nameInAnalyze = this.options.build.analyze && 'modern-[name].js'
    output.filename = nameInAnalyze || this.getFileName('modern')
    output.chunkFilename = nameInAnalyze || this.getFileName('modernChunk')
    return output
  }
}
