import _ from 'lodash'
import loaderUtils from 'loader-utils'

export default function loader(source) {
  if (this.cacheable) {
    this.cacheable()
  }

  // The following part renders the tempalte with lodash as aminimalistic loader
  //
  // Get templating options
  const options = this.query !== '' ? loaderUtils.parseQuery(this.query) : {}
  // Webpack 2 does not allow with() statements, which lodash templates use to unwrap
  // the parameters passed to the compiled template inside the scope. We therefore
  // need to unwrap them ourselves here. This is essentially what lodash does internally
  // To tell lodash it should not use with we set a variable
  const template = _.template(source, _.defaults(options, { variable: 'data' }))
  // All templateVariables which should be available
  // @see HtmlWebpackPlugin.prototype.executeTemplate
  const templateVariables = [
    'compilation',
    'webpack',
    'webpackConfig',
    'htmlWebpackPlugin'
  ]
  return 'var _ = require(' + loaderUtils.stringifyRequest(this, require.resolve('lodash')) + ');' +
    'module.exports = function (templateParams) {' +
      // Declare the template variables in the outer scope of the
      // lodash template to unwrap them
      templateVariables.map(function (variableName) {
        return 'var ' + variableName + ' = templateParams.' + variableName
      }).join(';') + ';' +
      // Execute the lodash template
      'return (' + template.source + ')();' +
    '}'
}
