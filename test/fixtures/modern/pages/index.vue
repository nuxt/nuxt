<template>
  <h1>Index page</h1>
</template>

<script>
export default {
  test () {
    const test = {
      build: true,
      test: true,
      arrow: () => { return 'build test' }
    }
    return {
      test
    }
  }
}
</script>
