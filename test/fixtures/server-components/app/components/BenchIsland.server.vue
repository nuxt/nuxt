<script setup lang="ts">
const props = defineProps<{ rows: number, clients: number, slots: number }>()
// The legacy islands transform cannot parse ">" inside a slot attribute.
const slotOn = computed(() => Array.from({ length: 21 }, (_, i) => i <= props.slots))
const clientOn = computed(() => Array.from({ length: 51 }, (_, i) => i <= props.clients))
</script>

<template>
  <div class="bench-island">
    <div v-for="i in rows" :key="i" class="row" :data-row="i">
      <span class="idx">Row {{ i }}</span>
      <b :class="{ odd: i % 2 === 1 }">{{ i * 2 }}</b>
      <a :href="`/item/${i}`" :title="`item ${i}`">item {{ i }}</a>
      <em v-if="i % 3 === 0">fizz</em>
    </div>
    <BenchCounter v-if="clientOn[1]" nuxt-client :start="1" />
    <BenchCounter v-if="clientOn[2]" nuxt-client :start="2" />
    <BenchCounter v-if="clientOn[3]" nuxt-client :start="3" />
    <BenchCounter v-if="clientOn[4]" nuxt-client :start="4" />
    <BenchCounter v-if="clientOn[5]" nuxt-client :start="5" />
    <BenchCounter v-if="clientOn[6]" nuxt-client :start="6" />
    <BenchCounter v-if="clientOn[7]" nuxt-client :start="7" />
    <BenchCounter v-if="clientOn[8]" nuxt-client :start="8" />
    <BenchCounter v-if="clientOn[9]" nuxt-client :start="9" />
    <BenchCounter v-if="clientOn[10]" nuxt-client :start="10" />
    <BenchCounter v-if="clientOn[11]" nuxt-client :start="11" />
    <BenchCounter v-if="clientOn[12]" nuxt-client :start="12" />
    <BenchCounter v-if="clientOn[13]" nuxt-client :start="13" />
    <BenchCounter v-if="clientOn[14]" nuxt-client :start="14" />
    <BenchCounter v-if="clientOn[15]" nuxt-client :start="15" />
    <BenchCounter v-if="clientOn[16]" nuxt-client :start="16" />
    <BenchCounter v-if="clientOn[17]" nuxt-client :start="17" />
    <BenchCounter v-if="clientOn[18]" nuxt-client :start="18" />
    <BenchCounter v-if="clientOn[19]" nuxt-client :start="19" />
    <BenchCounter v-if="clientOn[20]" nuxt-client :start="20" />
    <BenchCounter v-if="clientOn[21]" nuxt-client :start="21" />
    <BenchCounter v-if="clientOn[22]" nuxt-client :start="22" />
    <BenchCounter v-if="clientOn[23]" nuxt-client :start="23" />
    <BenchCounter v-if="clientOn[24]" nuxt-client :start="24" />
    <BenchCounter v-if="clientOn[25]" nuxt-client :start="25" />
    <BenchCounter v-if="clientOn[26]" nuxt-client :start="26" />
    <BenchCounter v-if="clientOn[27]" nuxt-client :start="27" />
    <BenchCounter v-if="clientOn[28]" nuxt-client :start="28" />
    <BenchCounter v-if="clientOn[29]" nuxt-client :start="29" />
    <BenchCounter v-if="clientOn[30]" nuxt-client :start="30" />
    <BenchCounter v-if="clientOn[31]" nuxt-client :start="31" />
    <BenchCounter v-if="clientOn[32]" nuxt-client :start="32" />
    <BenchCounter v-if="clientOn[33]" nuxt-client :start="33" />
    <BenchCounter v-if="clientOn[34]" nuxt-client :start="34" />
    <BenchCounter v-if="clientOn[35]" nuxt-client :start="35" />
    <BenchCounter v-if="clientOn[36]" nuxt-client :start="36" />
    <BenchCounter v-if="clientOn[37]" nuxt-client :start="37" />
    <BenchCounter v-if="clientOn[38]" nuxt-client :start="38" />
    <BenchCounter v-if="clientOn[39]" nuxt-client :start="39" />
    <BenchCounter v-if="clientOn[40]" nuxt-client :start="40" />
    <BenchCounter v-if="clientOn[41]" nuxt-client :start="41" />
    <BenchCounter v-if="clientOn[42]" nuxt-client :start="42" />
    <BenchCounter v-if="clientOn[43]" nuxt-client :start="43" />
    <BenchCounter v-if="clientOn[44]" nuxt-client :start="44" />
    <BenchCounter v-if="clientOn[45]" nuxt-client :start="45" />
    <BenchCounter v-if="clientOn[46]" nuxt-client :start="46" />
    <BenchCounter v-if="clientOn[47]" nuxt-client :start="47" />
    <BenchCounter v-if="clientOn[48]" nuxt-client :start="48" />
    <BenchCounter v-if="clientOn[49]" nuxt-client :start="49" />
    <BenchCounter v-if="clientOn[50]" nuxt-client :start="50" />
    <slot v-if="slotOn[1]" name="s1">
      <p class="slot">slot 1</p>
    </slot>
    <slot v-if="slotOn[2]" name="s2">
      <p class="slot">slot 2</p>
    </slot>
    <slot v-if="slotOn[3]" name="s3">
      <p class="slot">slot 3</p>
    </slot>
    <slot v-if="slotOn[4]" name="s4">
      <p class="slot">slot 4</p>
    </slot>
    <slot v-if="slotOn[5]" name="s5">
      <p class="slot">slot 5</p>
    </slot>
    <slot v-if="slotOn[6]" name="s6">
      <p class="slot">slot 6</p>
    </slot>
    <slot v-if="slotOn[7]" name="s7">
      <p class="slot">slot 7</p>
    </slot>
    <slot v-if="slotOn[8]" name="s8">
      <p class="slot">slot 8</p>
    </slot>
    <slot v-if="slotOn[9]" name="s9">
      <p class="slot">slot 9</p>
    </slot>
    <slot v-if="slotOn[10]" name="s10">
      <p class="slot">slot 10</p>
    </slot>
    <slot v-if="slotOn[11]" name="s11">
      <p class="slot">slot 11</p>
    </slot>
    <slot v-if="slotOn[12]" name="s12">
      <p class="slot">slot 12</p>
    </slot>
    <slot v-if="slotOn[13]" name="s13">
      <p class="slot">slot 13</p>
    </slot>
    <slot v-if="slotOn[14]" name="s14">
      <p class="slot">slot 14</p>
    </slot>
    <slot v-if="slotOn[15]" name="s15">
      <p class="slot">slot 15</p>
    </slot>
    <slot v-if="slotOn[16]" name="s16">
      <p class="slot">slot 16</p>
    </slot>
    <slot v-if="slotOn[17]" name="s17">
      <p class="slot">slot 17</p>
    </slot>
    <slot v-if="slotOn[18]" name="s18">
      <p class="slot">slot 18</p>
    </slot>
    <slot v-if="slotOn[19]" name="s19">
      <p class="slot">slot 19</p>
    </slot>
    <slot v-if="slotOn[20]" name="s20">
      <p class="slot">slot 20</p>
    </slot>
  </div>
</template>
