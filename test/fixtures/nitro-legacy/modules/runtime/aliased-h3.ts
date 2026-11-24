// @ts-expect-error alias provided by the module
import * as h3 from '#legacy-h3'

export default h3.defineEventHandler((event: any) => ({ query: h3.getQuery(event), h3v2: 'H3' in h3 }))
