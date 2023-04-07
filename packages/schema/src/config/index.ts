import adhoc from './adhoc'
import app from './app'
import build from './build'
import common from './common'
import dev from './dev'
import experimental from './experimental'
import generate from './generate'
import internal from './internal'
import nitro from './nitro'
import postcss from './postcss'
import router from './router'
import typescript from './typescript'
import vite from './vite'
import webpack from './webpack'

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
  ...vite,
  ...webpack
}
