<template>
  <div>
    <NuxtLink
      id="to-index"
      to="/useAsyncData/keepalive"
    >
      Index
    </NuxtLink> |
    <NuxtLink
      id="to-other"
      to="/useAsyncData/keepalive/other"
    >
      Other
    </NuxtLink>
    <hr>
    <button
      id="refresh-nuxt-data"
      @click="onRefresh"
    >
      refreshNuxtData
    </button>
    <NuxtPage :keepalive="{}" />
  </div>
</template>

<script setup lang="ts">
function onRefresh () {
  refreshNuxtData('useAsyncData:keepalive')
}
</script>
