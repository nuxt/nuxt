<template>
  <div class="layout-container">
    <slot />
  </div>
</template>

<style layout="xs">
.layout-container {
  --inline-custom-layout-token: custom-layout;
  padding: 10px;
}
</style>
