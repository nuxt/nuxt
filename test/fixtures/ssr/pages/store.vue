<template>
  <Foobar>{{ $store.state[$route.query.onServerInit === '1' ? 'id2': 'id'] }}</Foobar>
</template>
