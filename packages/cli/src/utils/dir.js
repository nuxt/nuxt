import fs from 'fs'
import path from 'path'

export function isNuxtDir (dir) {
  if (fs.existsSync(`${dir}${path.sep}nuxt.config.js`) ||
    fs.existsSync(`${dir}${path.sep}pages`) ||
    fs.existsSync(`${dir}${path.sep}nuxt.config.ts`)) {
    return true
  }
  return false
}
