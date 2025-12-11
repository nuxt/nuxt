import { defineHandler } from 'nitro/h3'

export default defineHandler(() => ({
  type: 'a',
  foo: 'bar',
}) as { type: 'a', foo: string } | { type: 'b', baz: string })
