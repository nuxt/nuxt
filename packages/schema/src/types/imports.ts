import { UnimportOptions } from 'unimport'

export interface AutoImportsOptions extends UnimportOptions {
  dirs?: string[]
  global?: boolean
  transform?: {
    exclude?: RegExp[]
    include?: RegExp[]
  }
}
