<template>
  <div>
    server-only component child (non-server-only)
  </div>
</template>
<script>
console.log('should not be in client bundle child')
</script>
<style>
:root {
  --server-only-child: 'server-only-child';
}
</style>
