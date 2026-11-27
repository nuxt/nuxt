import { describe, expect, it } from 'vitest'

import * as kitConstants from '../src/constants.ts'
import * as configConstants from '../../nuxt/src/config/constants.ts'

describe('default extension constants', () => {
  // `nuxt/config` cannot import `@nuxt/kit`, so the constants are duplicated in both packages
  it('should be in sync between `@nuxt/kit` and `nuxt/config`', () => {
    expect(kitConstants.DEFAULT_JS_FILE_EXTENSIONS).toEqual(configConstants.DEFAULT_JS_FILE_EXTENSIONS)
    expect(kitConstants.DEFAULT_JSX_FILE_EXTENSIONS).toEqual(configConstants.DEFAULT_JSX_FILE_EXTENSIONS)
  })
})
