<script setup lang="ts">
const session = useState('shared-account-session', () => useRequestEvent()?.context.session as string | undefined)
</script>

<template>
  <div data-testid="marker">
    {{ session ? `MARKER-${session}` : 'anonymous' }}
  </div>
</template>
