<template>
  <div>
    this is a normal component within a server component
    <Counter
      v-load-client
      :multiplier="1"
    />
  </div>
</template>
