export default defineEventHandler(() => ({
  type: 'a',
  foo: 'bar'
}) as { type: 'a', foo: string } | { type: 'b', baz: string })
