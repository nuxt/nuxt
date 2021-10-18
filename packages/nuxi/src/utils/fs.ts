import { promises as fsp } from 'fs'
import { promisify } from 'util'
import rimraf from 'rimraf'

// Check if a file exists
export async function exists (path: string) {
  try {
    await fsp.access(path)
    return true
  } catch {
    return false
  }
}

export async function clearDir (path: string) {
  await promisify(rimraf)(path)
  await fsp.mkdir(path, { recursive: true })
}
