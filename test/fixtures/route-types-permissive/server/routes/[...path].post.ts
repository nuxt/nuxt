const bodySchema = {
  '~standard': {
    version: 1 as const,
    vendor: 'fixture',
    validate: (value: unknown) => ({ value: value as { target: string } }),
    types: {} as { input: { target: string }, output: { target: string } },
  },
}

export default defineValidatedHandler({
  validate: { body: bodySchema },
  handler: () => ({ proxied: true }),
})
