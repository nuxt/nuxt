<script setup lang="ts">
// Usage depends on plugins/node.client.ts
const base64 = useState(() => atob(Buffer.from('Nuxt is Awesome!', 'utf8').toString('base64')))
const cwd = useState(() => process.cwd())
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
