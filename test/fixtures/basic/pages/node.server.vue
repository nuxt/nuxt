<script setup lang="ts">
const base64 = useState(() => atob(Buffer.from('Nuxt is Awesome!', 'utf8').toString('base64')))
const cwd = useState(() => process.cwd?.() && "works!")
</script>

<template>
  <div>
    <div>
      {{ base64 }}
    </div>
    <div>
      CWD: {{ cwd }}
    </div>
  </div>
</template>
