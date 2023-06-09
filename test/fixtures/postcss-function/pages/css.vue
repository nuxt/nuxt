<template>
  <div class="red">
    This is red
  </div>
</template>

<style>
@custom-selector :--red div.red;
:--red {
  background-color: blue;
}
.red {
  color: red;
}
</style>
