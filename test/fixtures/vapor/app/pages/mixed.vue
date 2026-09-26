<template>
  <div>
    <h1 data-testid="page-title">
      Mixed nesting
    </h1>
    <VdomChild>
      <VaporCounter label="vapor inside vdom slot" />
    </VdomChild>
    <VaporWrapper />
  </div>
</template>
