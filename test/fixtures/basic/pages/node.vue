<script setup lang="ts">
import process from 'node:process'
import { Buffer } from 'node:buffer'
const base64 = atob(Buffer.from('Nuxt is Awesome!', 'utf8').toString('base64'))
const cwd = process.cwd()
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
