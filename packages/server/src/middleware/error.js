import path from 'path'
import fs from 'fs-extra'
import consola from 'consola'

import Youch from '@nuxtjs/youch'

export default ({ resources, options }) => async function errorMiddleware (err, req, res, next) {
  // ensure statusCode, message and name fields

  const error = {
    statusCode: err.statusCode || 500,
    message: err.message || 'Nuxt Server Error',
    name: !err.name || err.name === 'Error' ? 'NuxtServerError' : err.name,
    headers: err.headers
  }

  const sendResponse = (content, type = 'text/html') => {
    // Set Headers
    res.statusCode = error.statusCode
    res.statusMessage = error.name
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
    if (err.statusCode !== 404) {
      consola.error(err)
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

  const errorFull = err instanceof Error
    ? err
    : typeof err === 'string'
      ? new Error(err)
      : new Error(err.message || JSON.stringify(err))

  errorFull.name = error.name
  errorFull.statusCode = error.statusCode
  errorFull.stack = err.stack || undefined

  // Show stack trace
  const youch = new Youch(
    errorFull,
    req,
    readSourceFactory({
      srcDir: options.srcDir,
      rootDir: options.rootDir,
      buildDir: options.buildDir
    }),
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

const readSourceFactory = ({ srcDir, rootDir, buildDir }) => async function readSource (frame) {
  // Remove webpack:/// & query string from the end
  const sanitizeName = name => name ? name.replace('webpack:///', '').split('?')[0] : null
  frame.fileName = sanitizeName(frame.fileName)

  // Return if fileName is unknown
  if (!frame.fileName) {
    return
  }

  // Possible paths for file
  const searchPath = [
    srcDir,
    rootDir,
    path.join(buildDir, 'dist', 'server'),
    buildDir,
    process.cwd()
  ]

  // Scan filesystem for real source
  for (const pathDir of searchPath) {
    const fullPath = path.resolve(pathDir, frame.fileName)
    const source = await fs.readFile(fullPath, 'utf-8').catch(() => null)
    if (source) {
      frame.contents = source
      frame.fullPath = fullPath
      if (path.isAbsolute(frame.fileName)) {
        frame.fileName = path.relative(rootDir, fullPath)
      }
      return
    }
  }
}
