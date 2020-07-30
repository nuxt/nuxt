export const sequence = function sequence<T, R> (
  tasks: T[],
  fn: (task: T) => R
) {
  return tasks.reduce(
    (promise, task): any => promise.then(() => fn(task)),
    Promise.resolve()
  )
}

export const parallel = function parallel<T, R> (
  tasks: T[],
  fn: (task: T) => R
) {
  return Promise.all(tasks.map(fn))
}

export const chainFn = function chainFn (base, fn) {
  if (typeof fn !== 'function') {
    return base
  }
  return function (...args) {
    if (typeof base !== 'function') {
      return fn.apply(this, args)
    }
    let baseResult = base.apply(this, args)
    // Allow function to mutate the first argument instead of returning the result
    if (baseResult === undefined) {
      [baseResult] = args
    }
    const fnResult = fn.call(
      this,
      baseResult,
      ...Array.prototype.slice.call(args, 1)
    )
    // Return mutated argument if no result was returned
    if (fnResult === undefined) {
      return baseResult
    }
    return fnResult
  }
}
