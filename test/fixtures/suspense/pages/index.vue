<template>
  <div>
    <div>Index Page</div>
    <NuxtLink id="btn-a" to="/target?a">
      Target A
    </NuxtLink>
    <NuxtLink id="btn-b" to="/target?b">
      Target B
    </NuxtLink>

    <button @click="trigger">
      Trigger (for manual testing)
    </button>
  </div>
</template>

<script setup>
function trigger () {
  document.getElementById('btn-a').click()
  document.getElementById('btn-b').click()
}
</script>
