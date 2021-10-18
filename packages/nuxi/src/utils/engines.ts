import { engines } from '../../package.json'

export async function checkEngines () {
  const semver = await import('semver').then(r => r.default || r)
  const currentNode = process.versions.node
  const nodeRange = engines.node

  if (!semver.satisfies(process.versions.node, engines.node)) {
    console.warn(`Current version of Node.js (\`${currentNode}\`) is unsupported and might cause issues.\n       Please upgrade to a compatible version (${nodeRange}).`)
  }
}
