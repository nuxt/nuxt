module.exports = function (options, next) {
  // Extend build
  this.extendBuild((config) => {
    const babelOptions = JSON.stringify(R.merge(this.options.build.babel, {
      presets: ['vue-app'],
      babelrc: false,
      cacheDirectory: !!this.dev
    }));
    // Add TypeScript loader
    config.module.rules.push({
      test: /\.tsx?$/,
      exclude: /node_modules|vue\/src/,
      use: [
        {
          loader: 'babel-loader?' + babelOptions,
        },
        {
          loader: 'ts-loader',
          options: {
            appendTsSuffixTo: [/\.vue$/],
            transpileOnly: true,
            isolatedModules: true
          }
        }
      ]
    })

    // Add TypeScript loader for vue files
    for (rule of config.module.rules) {
      if (rule.loader === 'vue-loader') {
        rule.query.loaders.ts = 'ts-loader?{"appendTsSuffixTo":["\\\\.vue$"]}'
      }
    }
  })

  next()
}
