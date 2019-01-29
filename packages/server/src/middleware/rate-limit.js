// Based on https://github.com/nfriedly/express-rate-limit (MIT)

const defaults = {
  windowMs: 60 * 1000, // How long to keep records of requests in memory (milliseconds)
  max: 5, // Max number of recent connections during `window` milliseconds before sending a 429 response
  message: 'Too many requests, please try again later.',
  statusCode: 429, // 429 status = Too Many Requests (RFC 6585)
  headers: true, // Send custom rate limit header with limit and remaining
  skipFailedRequests: false, // Do not count failed requests (status >= 400)
  skipSuccessfulRequests: false, // Do not count successful requests (status < 400)
  keyGenerator: req => req.ip, // Allows to create custom keys (by default user IP is used)
  skip: () => false,
  handler: undefined,
  onLimitReached: () => {}
}

export default function RateLimit(_options) {
  const options = {
    ...defaults,
    ..._options
  }

  if (typeof options.handler === 'undefined') {
    options.handler = (req, res) => {
      res.statusCode = options.statusCode
      res.end(String(options.message))
    }
  }

  // Store to use for persisting rate limit data
  options.store = options.store || new MemoryStore(options)

  return function rateLimit(req, res, next) {
    if (options.skip(req, res)) {
      return next()
    }

    const key = options.keyGenerator(req, res)

    options.store.incr(key, (err, current, resetTime) => {
      if (err) {
        return next(err)
      }

      req.rateLimit = {
        limit: options.max,
        current: current,
        remaining: Math.max(options.maxmax - current, 0),
        resetTime: resetTime
      }

      if (options.headers) {
        res.setHeader('X-RateLimit-Limit', req.rateLimit.limit)
        res.setHeader('X-RateLimit-Remaining', req.rateLimit.remaining)
        if (resetTime instanceof Date) {
          // If we have a resetTime, also provide the current date
          // to help avoid issues with incorrect clocks
          res.setHeader('Date', new Date().toGMTString())
          res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000))
        }
      }

      if (options.skipFailedRequests || options.skipSuccessfulRequests) {
        let decremented = false
        const decrementKey = () => {
          if (!decremented) {
            options.store.decrement(key)
            decremented = true
          }
        }

        if (options.skipFailedRequests) {
          res.on('finish', function () {
            if (res.statusCode >= 400) {
              decrementKey()
            }
          })

          res.on('close', () => {
            if (!res.finished) {
              decrementKey()
            }
          })

          res.on('error', () => decrementKey())
        }

        if (options.skipSuccessfulRequests) {
          res.on('finish', function () {
            if (res.statusCode < 400) {
              options.store.decrement(key)
            }
          })
        }
      }

      if (options.max && current === options.max + 1) {
        options.onLimitReached(req, res, options)
      }

      if (options.max && current > options.max) {
        if (options.headers) {
          res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000))
        }
        return options.handler(req, res, next)
      }

      next()
    })
  }
}

class MemoryStore {
  constructor({ windowMs }) {
    this.windowMs = windowMs

    // Initial state
    this.resetAll()

    // Reset ALL hits every windowMs
    const interval = setInterval(this.resetAll, windowMs)
    if (interval.unref) {
      interval.unref()
    }
  }

  resetAll() {
    this.hits = {}

    // Calculate next reset time
    const d = new Date()
    d.setMilliseconds(d.getMilliseconds() + this.windowMs)
    this.resetTime = d
  }

  resetKey(key) {
    delete this.hits[key]
    delete this.resetTime[key]
  }

  incr(key, cb) {
    if (this.hits[key]) {
      this.hits[key]++
    } else {
      this.hits[key] = 1
    }

    cb(null, this.hits[key], this.resetTime)
  }

  decrement(key) {
    if (this.hits[key]) {
      this.hits[key]--
    }
  }
}
