export type TypeCheckMode = boolean | 'build' | 'dev'

export function shouldTypeCheck (typeCheck: TypeCheckMode, isDev: boolean) {
  return typeCheck === true || typeCheck === (isDev ? 'dev' : 'build')
}
