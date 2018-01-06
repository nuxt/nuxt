const url = require('url')
const launch = require('launch-editor')
const lineNumberRE = /:(\d+)$/

// Temporary middleware until https://github.com/yyx990803/launch-editor/pull/1 releases

module.exports = (specifiedEditor, onErrorCallback) => {
  return function launchEditorMiddleware(req, res, next) {
    const { file } = url.parse(req.url, true).query || {}
    if (!file) {
      res.statusCode = 500
      res.end(`launch-editor-middleware: required query param "file" is missing.`)
    } else {
      const fileName = file.replace(lineNumberRE, '')
      const lineNumberMatch = file.match(lineNumberRE)
      const lineNumber = lineNumberMatch && lineNumberMatch[1]
      launch(fileName, lineNumber, specifiedEditor, onErrorCallback)
      res.end()
    }
  }
}
