// Regression test for https://github.com/nuxt/nuxt/issues/33979
import { serverAutoImported, someServerUtil } from '#imports/server'

const _result: string = serverAutoImported()
const _util: string = someServerUtil

// @ts-expect-error `serverAutoImported` returns the literal 'serverAutoImported'
const _wrong: number = serverAutoImported()

export default defineEventHandler(() => ({ result: _result, util: _util }))
