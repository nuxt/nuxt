import { viteNodeOptions } from '#vite-node'
import runner from '#vite-node-runner'

// evaluates module bodies only: the entry is not called, so no plugin, component or route
// code runs. A failure here is left for the first render to surface.
export default (): void => {
  if (viteNodeOptions.warmupPath) {
    setTimeout(() => runner.executeFile(viteNodeOptions.warmupPath!).catch(() => {}), 0)
  }
}
