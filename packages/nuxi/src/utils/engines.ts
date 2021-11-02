import { engines } from '../../package.json'

export async function checkEngines () {
  const satisfies = await import('semver/functions/satisfies.js').then(r => r.default) // npm/node-semver#381
  const currentNode = process.versions.node
  const nodeRange = engines.node

  if (!satisfies(currentNode, nodeRange)) {
    console.warn(`Current version of Node.js (\`${currentNode}\`) is unsupported and might cause issues.\n       Please upgrade to a compatible version (${nodeRange}).`)
  }
}
