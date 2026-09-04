/**
 * A client-side gate the tests can release via `window[releaseKey]()`.
 * Releasing is sticky: instances that register after the release resolve
 * immediately, so tests need not race component setup to release a gate.
 */
export function useTestGate (releaseKey: string): Promise<void> | undefined {
  if (import.meta.server) { return }
  const w = window as unknown as Record<string, unknown>
  const releasedKey = `${releaseKey}:released`
  if (w[releasedKey]) { return }
  return new Promise<void>((resolve) => {
    const resolvers = (w[`${releaseKey}:resolvers`] ??= []) as Array<() => void>
    resolvers.push(resolve)
    w[releaseKey] = () => {
      w[releasedKey] = true
      for (const r of resolvers.splice(0)) { r() }
    }
  })
}
