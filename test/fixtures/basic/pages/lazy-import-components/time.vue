<template>
  <div>
    <LazyDelayedTime hydrate:time />
    <LazyDelayedTime
      :hydrate:time="500"
    />
  </div>
</template>
