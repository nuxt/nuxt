/**
 * NuxtOptionsWatchers
 * Documentation: https://nuxtjs.org/api/configuration-watchers
 *                https://github.com/paulmillr/chokidar#api
 *                https://webpack.js.org/configuration/watch/#watchoptions
 */

import type { WatchOptions as ChokidarWatchOptions } from 'chokidar'
import type { WatchOptions as WebpackWatchOptions } from 'webpack'

export type NuxtOptionsWatchers = {
  chokidar?: ChokidarWatchOptions
  webpack?: WebpackWatchOptions
}
