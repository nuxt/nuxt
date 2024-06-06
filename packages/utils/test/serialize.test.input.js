// NOTE: This file is excluded from being transformed by babel-jest and needs to use the CommonJS syntax.

module.exports = {
  arrow: {
  // eslint-disable-next-line arrow-parens
    fn1: foobar => {},
    fn2: foobar => 1,
    // eslint-disable-next-line arrow-parens
    fn3: foobar => {
      return 3
    },

    fn4: arg1 =>
      2 * arg1,
    fn5: () => {},

    fn6: foobar => (foobar ? 1 : 0)
  },
  normal: {
    fn: function () {}
  },
  shorthand: {
    fn () {},
    // eslint-disable-next-line space-before-function-paren
    $fn() {},
    // eslint-disable-next-line no-unused-vars
    fn_arrow () { const _ = rule => rule },
    fn_script () {
      return 'function xyz(){};a=false?true:xyz();'
    },
    fn_internal (arg) {
      if (arg) {
        return {
          title () {
            return 'test'
          }
        }
      }
    }
  }
}
