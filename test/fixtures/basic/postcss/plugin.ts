import type { Plugin } from 'postcss'

const componentRoot = (_opts = {}): Plugin => {
  console.log('loaded custom postcss plugin')
  return {
    postcssPlugin: 'custom-postcss-plugin',
  }
}
componentRoot.postcss = true

export default componentRoot
