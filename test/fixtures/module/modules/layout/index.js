import { resolve } from 'path'

export default function module () {
  this.addLayout(
    { src: resolve(__dirname, 'some-error.vue') }, 'error')
}
