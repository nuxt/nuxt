<template>
  <div>
    <Head>
      <Link
        rel="alternate"
        href="/"
      />
      <Link
        key="dedupe-key"
        rel="x-test"
        :href="isServer ? 'server' : 'client'"
      />
    </Head>
  </div>
</template>

<script setup lang="ts">
const isServer = import.meta.server
</script>
