import { green, red, yellow, cyan } from 'colorette'

export const error = (...args: any[]) => console.error(red('[error]'), ...args)
export const warn = (...args: any[]) => console.warn(yellow('[warn]'), ...args)
export const info = (...args: any[]) => console.info(cyan('[info]'), ...args)
export const success = (...args: any[]) => console.log(green('[success]'), ...args)
