export default function typeScriptModule() {
  // Add .ts extension for store, middleware and more
  this.nuxt.options.extensions.push('ts')

  // Extend build
  this.extendBuild((config) => {
    // Add TypeScript loader
    config.module.rules.push({
      test: /\.ts$/,
      loader: 'ts-loader',
      options: {
        transpileOnly: true,
        appendTsSuffixTo: ['\\.vue$']
      }
    })
    // Add .ts extension in webpack resolve
    config.resolve.extensions.push('.ts')
  })
}
