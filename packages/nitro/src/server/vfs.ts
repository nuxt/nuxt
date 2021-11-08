import { createError, Handle } from 'h3'
import { NitroContext } from '..'

export function handleVfs (ctx: NitroContext): Handle {
  return (req) => {
    if (req.url === '/') {
      const items = Object.keys(ctx.vfs)
        .filter(i => !i.startsWith('#'))
        .map(key => `<li><a href="/_vfs/${encodeURIComponent(key)}">${key.replace(ctx._nuxt.rootDir, '')}</a></li>`)
        .join('\n')
      return `<!doctype html><html><body><ul>${items}</ul></body></html>`
    }
    const param = decodeURIComponent(req.url.slice(1))
    if (param in ctx.vfs) {
      return editorTemplate({
        readOnly: true,
        language: param.endsWith('html') ? 'html' : 'javascript',
        theme: 'vs-dark',
        value: ctx.vfs[param]
      })
    }
    return createError({ message: 'File not found', statusCode: 404 })
  }
}

const monacoVersion = '0.30.0'
const monacoUrl = `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${monacoVersion}/min`
const vsUrl = `${monacoUrl}/vs`

const editorTemplate = (options: Record<string, any>) => `
<!doctype html>
<html>
<head>
    <link rel="stylesheet" data-name="vs/editor/editor.main" href="${vsUrl}/editor/editor.main.min.css">
</head>
<body style="margin: 0">
<div id="editor" style="height:100vh"></div>
<script src="${vsUrl}/loader.min.js"></script>
<script>
  require.config({ paths: { vs: '${vsUrl}' } })

  const proxy = URL.createObjectURL(new Blob([\`
    self.MonacoEnvironment = { baseUrl: '${monacoUrl}' }
    importScripts('${vsUrl}/base/worker/workerMain.min.js')
  \`], { type: 'text/javascript' }))
  window.MonacoEnvironment = { getWorkerUrl: () => proxy }

  require(['vs/editor/editor.main'], function () {
    monaco.editor.create(document.getElementById('editor'), ${JSON.stringify(options)})
  })
</script>
</body>
</html>
`
