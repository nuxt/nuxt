const Youch = require('@nuxtjs/youch')
const { SourceMapConsumer } = require('source-map')
const { join, resolve } = require('path')
const { readFile } = require('fs-extra')

module.exports = function errorMiddleware(err, req, res, next) {
  // ensure statusCode, message and name fields
  err.statusCode = err.statusCode || 500
  err.message = err.message || 'Nuxt Server Error'
  err.name = (!err.name || err.name === 'Error') ? 'NuxtServerError' : err.name

  // We hide actual errors from end users, so show them on server logs
  if (err.statusCode !== 404) {
    console.error(err) // eslint-disable-line no-console
  }

  const sendResponse = (content, type = 'text/html') => {
    // Set Headers
    res.statusCode = err.statusCode
    res.statusMessage = err.name
    res.setHeader('Content-Type', type + '; charset=utf-8')
    res.setHeader('Content-Length', Buffer.byteLength(content))

    // Send Response
    res.end(content, 'utf-8')
  }

  // Check if request accepts JSON
  const hasReqHeader = (header, includes) => req.headers[header] && req.headers[header].toLowerCase().includes(includes)
  const isJson = hasReqHeader('accept', 'application/json') || hasReqHeader('user-agent', 'curl/')

  // Use basic errors when debug mode is disabled
  if (!this.options.debug) {
    // Json format is compatible with Youch json responses
    const json = {
      status: err.statusCode,
      message: err.message,
      name: err.name
    }
    if (isJson) {
      sendResponse(JSON.stringify(json, undefined, 2), 'text/json')
      return
    }
    const html = this.resources.errorTemplate(json)
    sendResponse(html)
    return
  }

  // Show stack trace
  const youch = new Youch(err, req, readSource.bind(this))
  if (isJson) {
    youch.toJSON().then(json => { sendResponse(JSON.stringify(json, undefined, 2), 'text/json') })
  } else {
    youch.toHTML().then(html => { sendResponse(html) })
  }
}

async function readSource(frame) {
  const serverBundle = this.resources.serverBundle

  // Remove webpack:/// & query string from the end
  const sanitizeName = name => name ? name.replace('webpack:///', '').split('?')[0] : ''

  // SourceMap Support for SSR Bundle
  if (serverBundle && serverBundle.maps[frame.fileName]) {
    // Initialize smc cache
    if (!serverBundle.$maps) {
      serverBundle.$maps = {}
    }

    // Read SourceMap object
    const smc = serverBundle.$maps[frame.fileName] || new SourceMapConsumer(serverBundle.maps[frame.fileName])
    serverBundle.$maps[frame.fileName] = smc

    // Try to find original position
    const { line, column, name, source } = smc.originalPositionFor({
      line: frame.getLineNumber() || 0,
      column: frame.getColumnNumber() || 0,
      bias: SourceMapConsumer.LEAST_UPPER_BOUND
    })
    if (line) {
      frame.lineNumber = line
    }
    /* istanbul ignore if */
    if (column) {
      frame.columnNumber = column
    }
    /* istanbul ignore if */
    if (name) {
      frame.functionName = name
    }
    if (source) {
      frame.fileName = sanitizeName(source)

      // Source detected, try to get original source code
      const contents = smc.sourceContentFor(source)
      if (contents) {
        frame.contents = contents
      }
    }
  }

  // Return if fileName is still unknown
  if (!frame.fileName) {
    return
  }

  frame.fileName = sanitizeName(frame.fileName)

  // Try to read from SSR bundle files
  if (serverBundle && serverBundle.files[frame.fileName]) {
    frame.contents = serverBundle.files[frame.fileName]
    return
  }

  // Possible paths for file
  const searchPath = [
    this.options.rootDir,
    join(this.options.buildDir, 'dist'),
    this.options.srcDir,
    this.options.buildDir
  ]

  // Scan filesystem for real path
  for (let pathDir of searchPath) {
    let fullPath = resolve(pathDir, frame.fileName)
    let source = await readFile(fullPath, 'utf-8').catch(() => null)
    if (source) {
      if (!frame.contents) {
        frame.contents = source
      }
      frame.fullPath = fullPath
      return
    }
  }
}
