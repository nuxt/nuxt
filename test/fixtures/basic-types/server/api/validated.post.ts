interface ValidatedBody {
  title: string
  count: number
}

const bodySchema = {
  '~standard': {
    version: 1 as const,
    vendor: 'fixture',
    validate: (value: unknown) => ({ value: value as ValidatedBody }),
    types: {} as { input: ValidatedBody, output: ValidatedBody },
  },
}

export default defineValidatedHandler({
  validate: { body: bodySchema },
  handler: () => ({ created: true }),
})
