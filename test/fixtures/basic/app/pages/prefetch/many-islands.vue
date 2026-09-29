<template>
  <div>
    <AsyncServerComponent
      v-for="count in 8"
      :key="count"
      :count="count"
    />
  </div>
</template>
