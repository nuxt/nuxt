import path from 'path'
import get from 'lodash/get'
import consola from 'consola'

// Guard dir1 from dir2 which can be indiscriminately removed
export const guardDir = function guardDir (options: Record<string, any>, key1: string, key2: string) {
  const dir1 = get(options, key1, false) as string
  const dir2 = get(options, key2, false) as string

  if (
    dir1 &&
    dir2 &&
    (
      dir1 === dir2 ||
      (
        dir1.startsWith(dir2) &&
        !path.basename(dir1).startsWith(path.basename(dir2))
      )
    )
  ) {
    const errorMessage = `options.${key2} cannot be a parent of or same as ${key1}`
    consola.fatal(errorMessage)
    throw new Error(errorMessage)
  }
}
