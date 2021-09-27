import { join } from 'pathe'
import fsExtra from 'fs-extra'

export const wpfs = {
  ...fsExtra,
  join
}
