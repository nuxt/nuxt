<template>
  <div>loading test</div>
</template>

<style>
.nuxt-progress {
  animation-duration: .001s;
  animation-name: nodeInserted;
}

@keyframes nodeInserted {
  from { opacity: 0.99; }
  to { opacity: 1; }
}
</style>
