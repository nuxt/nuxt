<template>
  <div>
    <nuxt-link to="/">
      Home
    </nuxt-link>
    <h2>{{ $route.path }}</h2>
    <pre>{{ foo }}</pre>
    <pre>{{ bar }}</pre>
    <pre>{{ from }}</pre>
  </div>
</template>

<script>
import { useAsyncData } from '@nuxt/app'
const waitFor = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))

export default {
  async setup () {
    const asyncData = useAsyncData()

    const { data: foo } = await asyncData('foo', async () => {
      await waitFor(500)
      return { foo: true }
    })
    const { data: bar } = await asyncData('bar', async () => {
      await waitFor(500)
      return { bar: true }
    })

    const { data: from } = await asyncData('from', () => ({ from: process.server ? 'server' : 'client' }))

    return {
      foo,
      bar,
      from
    }
  }
}
</script>
