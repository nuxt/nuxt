import escapeRE from 'escape-string-regexp'

interface WaitPlugin {
  name: string
  enforce: 'pre'
  load: {
    order: 'pre'
    filter: { id: RegExp }
    handler: () => Promise<void>
  }
}

export function handleEarlyRejection<T> (promise: Promise<T>): Promise<T> {
  void promise.catch(() => {})
  return promise
}

export function createWaitForModulePlugin (name: string, id: string, dependency: Promise<unknown>): WaitPlugin {
  return {
    name,
    enforce: 'pre',
    load: {
      order: 'pre',
      filter: { id: new RegExp(`^${escapeRE(id)}$`) },
      async handler () {
        await dependency
      },
    },
  }
}

export async function finishConcurrentBuild (
  prerenderTask: Promise<void>,
  getFinalBuildTask: () => Promise<void> | undefined,
  startFinalBuildTask: () => Promise<void>,
  onPrerenderComplete?: () => void,
): Promise<void> {
  let prerenderError: unknown
  try {
    await prerenderTask
  } catch (error) {
    prerenderError = error
  }

  const runningFinalBuild = getFinalBuildTask()
  if (!runningFinalBuild && prerenderError) {
    throw prerenderError
  }

  if (!prerenderError) {
    onPrerenderComplete?.()
  }

  let finalBuildError: unknown
  try {
    await (runningFinalBuild || startFinalBuildTask())
  } catch (error) {
    finalBuildError = error
  }

  if (prerenderError) {
    throw prerenderError
  }
  if (finalBuildError) {
    throw finalBuildError
  }
}
