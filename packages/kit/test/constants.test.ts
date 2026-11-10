import { describe, expect, it } from 'vitest'

import * as kitConstants from '../src/constants.ts'
import * as schemaConstants from '../../schema/src/constants.ts'

describe('default extension constants', () => {
  // `@nuxt/schema` cannot be a runtime dependency of `@nuxt/kit`, so the constants are duplicated in both packages
  it('should be in sync between `@nuxt/kit` and `@nuxt/schema`', () => {
    expect(kitConstants.DEFAULT_JS_FILE_EXTENSIONS).toEqual(schemaConstants.DEFAULT_JS_FILE_EXTENSIONS)
    expect(kitConstants.DEFAULT_JSX_FILE_EXTENSIONS).toEqual(schemaConstants.DEFAULT_JSX_FILE_EXTENSIONS)
  })
})
