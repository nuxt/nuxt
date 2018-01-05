
const openInEditor = require('open-in-editor')

module.exports = function openInEditorMiddleware(req, res) {
  // Lazy load open-in-editor
  const editor = openInEditor.configure(this.options.editor)

  // Parse Query
  const query = req.url.split('?')[1].split('&').reduce((q, part) => {
    const s = part.split('=')
    q[s[0]] = decodeURIComponent(s[1])
    return q
  }, {})

  // eslint-disable-next-line no-console
  console.log('[open in editor]', query.file)

  editor.open(query.file).then(() => {
    res.end('opened in editor!')
  }).catch(err => {
    res.end(err)
  })
}
