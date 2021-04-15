import { red, yellow, cyan } from 'colorette'

export const error = (...args) => console.error(red('[error]'), ...args)
export const warn = (...args) => console.warn(yellow('[warn]'), ...args)
export const info = (...args) => console.info(cyan('[info]'), ...args)
