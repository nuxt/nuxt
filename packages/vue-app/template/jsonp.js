const chunks = {} // chunkId => exports
const chunksInstalling = {} // chunkId => Promise
const failedChunks = {}

function importChunk(chunkId, src) {
  // Already installed
  if (chunks[chunkId]) {
    return Promise.resolve(chunks[chunkId])
  }

  // Failed loading
  if (failedChunks[chunkId]) {
    return Promise.reject(failedChunks[chunkId])
  }

  // Installing
  if (chunksInstalling[chunkId]) {
    return chunksInstalling[chunkId]
  }

  // Set a promise in chunk cache
  let resolve, reject
  const promise = chunksInstalling[chunkId] = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })

  // Clear chunk data from cache
  delete chunks[chunkId]

  // Start chunk loading
  const script = document.createElement('script')
  script.charset = 'utf-8'
  script.timeout = 120
  script.src = src
  let timeout

  // Create error before stack unwound to get useful stacktrace later
  const error = new Error()

  // Complete handlers
  const onScriptComplete = script.onerror = script.onload = (event) => {
    // Cleanups
    clearTimeout(timeout)
    delete chunksInstalling[chunkId]

    // Avoid mem leaks in IE
    script.onerror = script.onload = null

    // Verify chunk is loaded
    if (chunks[chunkId]) {
      return resolve(chunks[chunkId])
    }

    // Something bad happened
    const errorType = event && (event.type === 'load' ? 'missing' : event.type)
    const realSrc = event && event.target && event.target.src
    error.message = 'Loading chunk ' + chunkId + ' failed.\n(' + errorType + ': ' + realSrc + ')'
    error.name = 'ChunkLoadError'
    error.type = errorType
    error.request = realSrc
    failedChunks[chunkId] = error
    reject(error)
  }

  // Timeout
  timeout = setTimeout(() => {
    onScriptComplete({ type: 'timeout', target: script })
  }, 120000)

  // Append script
  document.head.appendChild(script)

  // Return promise
  return promise
}

export function installJsonp() {
  window.__NUXT_JSONP__ = function (chunkId, exports) { chunks[chunkId] = exports }
  window.__NUXT_JSONP_CACHE__ = chunks
  window.__NUXT_IMPORT__ = importChunk
}

