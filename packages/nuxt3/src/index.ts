import { resolve } from 'path'

export const APP_DIR = resolve(__dirname, 'app')

export { loadNuxt } from './core'
export { build } from './builder'
export { main } from './cli'
