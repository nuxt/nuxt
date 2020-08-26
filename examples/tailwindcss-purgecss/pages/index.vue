<template>
  <div>
    <h2 class="mb-4 text-blue-500">
      Homepage
    </h2>
    <p class="mb-4 bg-grey-400 p-4 text-sm rounded leading-normal">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut dolor placerat enim suscipit porttitor et sodales orci. In eget lorem a odio rhoncus finibus vel quis ex. Donec varius nisl ligula, vel finibus velit dignissim in.
    </p>
    <MyComponent />
  </div>
</template>

<script>
import MyComponent from '~/components/MyComponent'

export default {
  components: {
    MyComponent
  }
}
</script>
