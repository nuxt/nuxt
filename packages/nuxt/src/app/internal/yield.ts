/**
 * Ends the current task so the browser can handle input and render, then resumes.
 * Resolves without yielding when the document is hidden.
 * @internal
 */
export function yieldToMain (): Promise<void> {
  if (document.visibilityState !== 'visible') {
    return Promise.resolve()
  }
  return new Promise(resolve => setTimeout(resolve))
}

/**
 * Resolves in a task after the next frame when nothing has painted yet, or after
 * 100ms if no frame is produced. Otherwise behaves like `yieldToMain`.
 * @internal
 */
export function waitForPaint (): Promise<void> {
  if (document.visibilityState !== 'visible' || window.performance.getEntriesByType('paint').length) {
    return yieldToMain()
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 100)
    requestAnimationFrame(() => {
      clearTimeout(timeout)
      resolve(yieldToMain())
    })
  })
}
