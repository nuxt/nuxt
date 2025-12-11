import { defineHandler } from 'nitro/h3'

export default defineHandler(() => ({
  foo: 'bar',
  baz: 'qux',
}))
