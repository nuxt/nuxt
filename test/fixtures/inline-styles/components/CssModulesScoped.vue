<template>
  <div :class="$style.box">
    css-modules-scoped
  </div>
</template>

<style module>
.box {
  --inline-css-modules-scoped-token: css-modules-scoped;
}
</style>
