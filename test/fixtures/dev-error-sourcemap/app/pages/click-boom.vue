<script setup lang="ts">
function throwInTheBrowser (): never {
  throw new Error('boom from a click')
}

function rejectWithAValue () {
  Promise.reject('failure')
}
</script>

<template>
  <div>
    click boom healthy
    <button @click="throwInTheBrowser()">
      throw
    </button>
    <button @click="rejectWithAValue()">
      reject
    </button>
    <NuxtLink to="/ok">
      to ok
    </NuxtLink>
    <NuxtLink to="/rejects-on-load">
      to rejects on load
    </NuxtLink>
    <NuxtLink to="/rejects-on-load?failure">
      to rejects the same value on load
    </NuxtLink>
  </div>
</template>
