<script setup lang="ts">
import { Buffer } from 'node:buffer'
import process from 'node:process'

const base64 = atob(Buffer.from('Nuxt is Awesome!', 'utf8').toString('base64'))
const cwd = typeof process.cwd == 'function' && "[available]"
</script>

<template>
  <div>
    <ClientOnly>
      <div>
        {{ base64 }}
      </div>
      <div>
        CWD: {{ cwd }}
      </div>
    </ClientOnly>
  </div>
</template>
