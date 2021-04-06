export const globalTiming = globalThis.__timing__ || {
  start: () => 0,
  end: () => 0,
  metrics: []
}

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing
export function timingMiddleware (_req, res, next) {
  const start = globalTiming.start()

  const _end = res.end
  res.end = (data, encoding, callback) => {
    const metrics = [['Generate', globalTiming.end(start)], ...globalTiming.metrics]
    const serverTiming = metrics.map(m => `-;dur=${m[1]};desc="${encodeURIComponent(m[0])}"`).join(', ')
    if (!res.headersSent) {
      res.setHeader('Server-Timing', serverTiming)
    }
    _end.call(res, data, encoding, callback)
  }

  next()
}
