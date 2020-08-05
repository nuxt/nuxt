import fs from 'fs'
import path from 'path'

export function isNuxtDir (rootDir) {
  if (fs.existsSync(path.join(rootDir, 'nuxt.config.js')) ||
    fs.existsSync(path.join(rootDir, 'pages')) ||
    fs.existsSync(path.join(rootDir, 'nuxt.config.ts'))) {
    return true
  }
  return false
}
