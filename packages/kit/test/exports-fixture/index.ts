export const named = 1
const local = 2
export { local as renamed }
export function fn () {}
export class Klass { value = 1 }
export default 'default'
export type OnlyType = string
export type { OnlyType as AliasedType }
export * from './star.ts'
export * as ns from './star.ts'
