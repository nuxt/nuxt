<template lang="pug">
  div
    LazyDelayedComponent(
      data-testid="hydrate-after"
      :hydrate-after="50"
    )
</template>
