import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  modules: ['./module-with-dep/module'],
  pages: false,
})
