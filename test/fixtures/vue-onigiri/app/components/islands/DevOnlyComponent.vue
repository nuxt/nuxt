<template>
  <div>
    <DevOnly>
      <p>onigiri dev-only content</p>
      <template #fallback>
        <p>onigiri prod-only fallback</p>
      </template>
    </DevOnly>
  </div>
</template>
