<template>
  <div>
    <div class="mt-4 bg-orange-lightest border-l-4 border-orange text-orange-dark p-4">
      <p class="font-bold">Be Warned!</p>
      <p>This page has been {{ mode }}-side rendered!</p>
    </div>
    <button @click="$router.push('/')" class="mt-4 bg-blue hover:bg-blue-light text-white font-bold py-2 px-4 border-b-4 border-blue-dark hover:border-blue rounded">
      Back to home
    </button>
  </div>
</template>

<script>
export default {
  asyncData: () => ({
    mode: (process.server ? 'server' : 'client')
  })
}
</script>
