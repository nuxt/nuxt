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
import { defineNuxtComponent, asyncData } from '@nuxt/app'
const waitFor = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))

export default defineNuxtComponent({
  setup () {
    const { data: foo } = asyncData('foo', async () => {
      await waitFor(500)
      return { foo: true }
    })
    const { data: bar } = asyncData('bar', async () => {
      await waitFor(500)
      return { bar: true }
    })

    const { data: from } = asyncData('from', () => ({ from: process.server ? 'server' : 'client' }))

    return {
      foo,
      bar,
      from
    }
  }
})
</script>
