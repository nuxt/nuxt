import process from 'node:process'
import { runtime } from 'std-env'
import { satisfies } from 'verkit'
import nuxt from '../../../nuxt/package.json' with { type: 'json' }

/**
 * Advice to upgrade to a Node.js version Nuxt supports, or `undefined` if the running Node.js
 * is supported or the runtime is not Node.js.
 */
export function describeUnsupportedNode (): string | undefined {
  const range = nuxt.engines.node
  if (runtime === 'node' && !satisfies(process.versions.node, range, { includePrerelease: true })) {
    return `Upgrade Node.js to a supported version (\`${range}\`).`
  }
}

/**
 * How to get a runtime that can strip types, or `undefined` if the running one can.
 */
export function describeMissingTypeStripping (): string | undefined {
  if (runtime !== 'node' || process.features.typescript) {
    return
  }
  return describeUnsupportedNode() ?? 'Type stripping is turned off in this Node.js process. Remove `--no-strip-types` or `--no-experimental-strip-types` from the command line and `NODE_OPTIONS`.'
}
