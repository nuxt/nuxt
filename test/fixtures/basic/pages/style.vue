<template>
  <div>
    <h1>H1 is rebeccapurple</h1>
    {{ $style }}
  </div>
</template>

<style>
h1 {
  color: rebeccapurple;
}
</style>

<style module>
:local(.foo) {
  color: blue !important;
}
</style>
