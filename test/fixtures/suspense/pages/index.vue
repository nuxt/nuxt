<template>
  <div>
    <div>Index Page</div>
    <NuxtLink
      id="btn-a"
      to="/target?a"
    >
      Target A
    </NuxtLink>
    <NuxtLink
      id="btn-b"
      to="/target?b"
    >
      Target B
    </NuxtLink>

    <button @click="trigger">
      Trigger (for manual testing)
    </button>
  </div>
</template>

<script setup>
async function trigger () {
  document.getElementById('btn-a').click()
  await new Promise(resolve => setTimeout(resolve, 10))
  document.getElementById('btn-b').click()
}
</script>
