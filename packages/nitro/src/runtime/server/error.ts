// import ansiHTML from 'ansi-html'
const cwd = process.cwd()

// TODO: Handle process.env.DEBUG
export function handleError (error, req, res) {
  const stack = (error.stack || '')
    .split('\n')
    .splice(1)
    .filter(line => line.includes('at '))
    .map((line) => {
      const text = line
        .replace(cwd + '/', './')
        .replace('webpack:/', '')
        .replace('.vue', '.js') // TODO: Support sourcemap
        .trim()
      return {
        text,
        internal: (line.includes('node_modules') && !line.includes('.cache')) ||
          line.includes('internal') ||
          line.includes('new Promise')
      }
    })

  console.error(error.message + '\n' + stack.map(l => '  ' + l.text).join('  \n'))

  const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Nuxt Error</title>
    <style>
      html, body {
        background: white;
        color: red;
        font-family: monospace;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        height: 100%;
      }
      .stack {
        padding-left: 2em;
      }
      .stack.internal {
        color: grey;
      }
    </style>
  </head>
  <body>
    <div>
      <div>${req.method} ${req.url}</div><br>
      <h1>${error.toString()}</h1>
      <pre>${stack.map(i =>
        `<span class="stack${i.internal ? ' internal' : ''}">${i.text}</span>`
  ).join('\n')
    }</pre>
    </div>
  </body>
</html>
`

  res.statusCode = error.statusCode || 500
  res.statusMessage = error.statusMessage || 'Internal Error'
  res.end(html)
}
