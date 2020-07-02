import path from 'path'
import fs from 'fs-extra'
import consola from 'consola'

import Youch from '@nuxtjs/youch'

export default ({ resources, options }) => async function errorMiddleware (_error, req, res, next) {
  // Normalize error
  const error = normalizeError(_error, options)

  const sendResponse = (content, type = 'text/html') => {
    // Set Headers
    res.statusCode = error.statusCode
    res.statusMessage = 'RuntimeError'
    res.setHeader('Content-Type', type + '; charset=utf-8')
    res.setHeader('Content-Length', Buffer.byteLength(content))
    res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate')

    // Error headers
    if (error.headers) {
      for (const name in error.headers) {
        res.setHeader(name, error.headers[name])
      }
    }

    // Send Response
    res.end(content, 'utf-8')
  }

  // Check if request accepts JSON
  const hasReqHeader = (header, includes) =>
    req.headers[header] && req.headers[header].toLowerCase().includes(includes)
  const isJson =
    hasReqHeader('accept', 'application/json') ||
    hasReqHeader('user-agent', 'curl/')

  // Use basic errors when debug mode is disabled
  if (!options.debug) {
    // We hide actual errors from end users, so show them on server logs
    if (error.statusCode !== 404) {
      consola.error(error)
    }

    // Json format is compatible with Youch json responses
    const json = {
      status: error.statusCode,
      message: error.message,
      name: error.name
    }
    if (isJson) {
      sendResponse(JSON.stringify(json, undefined, 2), 'text/json')
      return
    }
    const html = resources.errorTemplate(json)
    sendResponse(html)
    return
  }

  // Show stack trace
  const youch = new Youch(
    error,
    req,
    readSource,
    options.router.base,
    true
  )
  if (isJson) {
    const json = await youch.toJSON()
    sendResponse(JSON.stringify(json, undefined, 2), 'text/json')
    return
  }

  const html = await youch.toHTML()
  sendResponse(html)
}

const sanitizeName = name => name ? name.replace('webpack:///', '').split('?')[0] : null

const normalizeError = (_error, { srcDir, rootDir, buildDir }) => {
  if (typeof _error === 'string') {
    _error = { message: _error }
  } else if (!_error) {
    _error = { message: '<empty>' }
  }

  const error = new Error()
  error.message = _error.message
  error.name = _error.name
  error.statusCode = _error.statusCode || 500
  error.headers = _error.headers

  const searchPath = [
    srcDir,
    rootDir,
    path.join(buildDir, 'dist', 'server'),
    buildDir,
    process.cwd()
  ]

  const findInPaths = (fileName) => {
    for (const dir of searchPath) {
      const fullPath = path.resolve(dir, fileName)
      if (fs.existsSync(fullPath)) {
        return fullPath
      }
    }
    return fileName
  }

  error.stack = (_error.stack || '')
    .split('\n')
    .map((line) => {
      const match = line.match(/\(([^)]+)\)|([^\s]+\.[^\s]+):/)
      if (!match) {
        return line
      }
      const src = match[1] || match[2] || ''
      return line.replace(src, findInPaths(sanitizeName(src)))
    })
    .join('\n')

  return error
}

async function readSource (frame) {
  if (fs.existsSync(frame.fileName)) {
    frame.fullPath = frame.fileName // Youch BW compat
    frame.contents = await fs.readFile(frame.fileName, 'utf-8')
  }
}
