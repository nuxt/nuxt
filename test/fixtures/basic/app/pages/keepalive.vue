<script setup lang="ts">
const links = ['keepalive-in-config', 'not-keepalive', 'keepalive-in-nuxtpage', 'keepalive-in-nuxtpage-2', 'not-keepalive-in-nuxtpage']
</script>

<template>
  <div>
    <h1>Keepalive Test</h1>
    <NuxtLink
      id="keepalive-home"
      to="/keepalive"
    >
      Keepalive Home
    </NuxtLink>
    <div :style="{ display: 'flex', flexDirection: 'column', marginTop: '10px' }">
      <NuxtLink
        v-for="link in links"
        :id="link"
        :key="link"
        :to="`/keepalive/${link}`"
      >
        {{ link }}
      </NuxtLink>
    </div>
    <NuxtPage :keepalive="{ include: ['keepalive-in-nuxtpage', 'keepalive-in-nuxtpage-2'], exclude: ['not-keepalive-in-nuxtpage'] }" />
  </div>
</template>
