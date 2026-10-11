interface SearchQuery {
  q: string
  page: string
}

interface SearchHeaders {
  'x-api-key': string
}

const querySchema = {
  '~standard': {
    version: 1 as const,
    vendor: 'fixture',
    validate: (value: unknown) => ({ value: value as SearchQuery }),
    types: {} as { input: SearchQuery, output: SearchQuery },
  },
}

const headersSchema = {
  '~standard': {
    version: 1 as const,
    vendor: 'fixture',
    validate: (value: unknown) => ({ value: value as SearchHeaders }),
    types: {} as { input: SearchHeaders, output: SearchHeaders },
  },
}

export default defineValidatedHandler({
  validate: { query: querySchema, headers: headersSchema },
  handler: () => ({ results: [] as string[] }),
})
