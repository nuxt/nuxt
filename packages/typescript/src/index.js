import { generateTsConfigIfMissing } from './config-generation'
import { registerTsNode } from './ts-node'

export async function setup(rootDir) {
  await generateTsConfigIfMissing(rootDir)
  registerTsNode()
}
