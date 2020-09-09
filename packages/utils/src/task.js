export const sequence = function sequence (tasks, fn) {
  return tasks.reduce(
    (promise, task) => promise.then(() => fn(task)),
    Promise.resolve()
  )
}

export const parallel = function parallel (tasks, fn) {
  return Promise.all(tasks.map(fn))
}

export const chainFn = function chainFn (base, fn) {
  if (typeof fn !== 'function') {
    return base
  }

  if (typeof base !== 'function') {
    return fn
  }

  return function (arg0, ...args) {
    const next = (previous = arg0) => {
      const fnResult = fn.call(this, previous, ...args)

      if (fnResult && typeof fnResult.then === 'function') {
        return fnResult.then(res => res || previous)
      }

      return fnResult || previous
    }

    const baseResult = base.call(this, arg0, ...args)

    if (baseResult && typeof baseResult.then === 'function') {
      return baseResult.then(res => next(res))
    }

    return next(baseResult)
  }
}
