<template>
  <div>
    About
    {{ path }}
    <button @click="path = 'newpath'">
      Update path
    </button>
  </div>
</template>

<script lang="ts">
import { defineNuxtComponent } from '@nuxt/app'
import { ref } from 'vue'

export default defineNuxtComponent({
  fetchKey: 'custom',
  asyncData ({ route }) {
    return {
      path: route.path
    }
  },
  setup () {
    // This will get overwritten with asyncData
    const path = ref('original path')

    return {
      path
    }
  }
})
</script>
