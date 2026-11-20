<!-- `v-load-client` rather than `nuxt-client`, so legacy builds never treat these as selective-client targets -->
<template>
  <div>
    <PairedLoadClient v-load-client />
    <SoloLoadClient v-load-client />
  </div>
</template>
