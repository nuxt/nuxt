<template>
  <div>
    <slot />
  </div>
</template>

<style scoped>
:slotted(.server-slotted) {
  color: rgb(1 2 3);
}
</style>
