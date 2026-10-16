<template>
  <div class="inline-styled">
    inline styles
  </div>
</template>

<style scoped>
.inline-styled::before {
  content: "`";
}
.inline-styled {
  background-image: url('/public.svg');
}
</style>
