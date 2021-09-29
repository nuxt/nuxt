<template>
  <tr><td><b>useFetch</b></td><td> {{ fetched }}</td></tr>
</template>

<script lang="ts">
import { defineComponent, ref, useFetch } from '@nuxtjs/composition-api'

export default defineComponent({
  setup () {
    const fetched = ref('🚧')
    useFetch(() => {
      fetched.value = '✅'
    })

    return {
      fetched
    }
  }
})
</script>
