import { UnimportOptions } from 'unimport'

export interface ImportsOptions extends UnimportOptions {
  dirs?: string[]
  global?: boolean
  transform?: {
    exclude?: RegExp[]
    include?: RegExp[]
  }
}
