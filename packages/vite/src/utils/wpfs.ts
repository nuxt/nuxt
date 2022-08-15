import { join } from 'pathe'
import fse from 'fs-extra'

export const wpfs = {
  ...fse,
  join
} as typeof fse & { join: typeof join }
