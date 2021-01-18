import { resolve } from 'path'
export * from './core'

export const APP_DIR = resolve(__dirname, 'app')

export const getBuilder = () => import('./builder')
