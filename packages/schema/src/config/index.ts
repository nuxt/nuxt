import adhoc from './adhoc.ts'
import app from './app.ts'
import build from './build.ts'
import common from './common.ts'
import dev from './dev.ts'
import esbuild from './esbuild.ts'
import oxc from './oxc.ts'
import experimental from './experimental.ts'
import generate from './generate.ts'
import internal from './internal.ts'
import nitro from './nitro.ts'
import postcss from './postcss.ts'
import router from './router.ts'
import typescript from './typescript.ts'
import vite from './vite.ts'
import webpack from './webpack.ts'
import type { InputObject } from 'untyped'

export default {
  ...adhoc,
  ...app,
  ...build,
  ...common,
  ...dev,
  ...experimental,
  ...generate,
  ...internal,
  ...nitro,
  ...postcss,
  ...router,
  ...typescript,
  ...esbuild,
  ...oxc,
  ...vite,
  ...webpack,
} as InputObject
