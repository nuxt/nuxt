module.exports = class WP5Fix {
  apply(compiler) {
    // Fix for html-webpack-lugin!
    compiler.hooks.thisCompilation.tap('HtmlWebpackPlugin', (compilation) => {
      compilation.compilationDependencies = {
        add() {
          // eslint-disable-next-line no-console
          // console.error(new Error('compilation.compilationDependencies is removed!'))
        }
      }
    })
  }
}
