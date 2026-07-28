import type { H3Error } from 'h3'
import type { HTTPError } from 'h3-next'

export type ErrorPartial = Partial<HTTPError> | Partial<H3Error>
