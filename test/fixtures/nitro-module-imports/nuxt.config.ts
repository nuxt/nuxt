import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  modules: ['./vendor/node_modules/installed-module'],
  experimental: {
    nitroAutoImports: false,
  },
})
