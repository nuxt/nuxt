export type TypeCheckOption = boolean | 'build' | 'dev'

/** Whether Nuxt should run builder type-checking for this command. */
export function shouldEnableTypeCheck (
  typeCheck: TypeCheckOption,
  options: { dev: boolean, test?: boolean },
): boolean {
  if (options.test) {
    return false
  }
  if (typeCheck === true) {
    return true
  }
  if (typeCheck === 'build') {
    return !options.dev
  }
  if (typeCheck === 'dev') {
    return options.dev
  }
  return false
}
