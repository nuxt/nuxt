/**
 * NuxtConfigurationWatchers
 * Documentation: https://nuxtjs.org/api/configuration-watchers
 *                https://github.com/paulmillr/chokidar#api
 *                https://webpack.js.org/configuration/watch/#watchoptions
 */

import { WatchOptions as ChokidarWatchOptions } from 'chokidar'
import { WatchOptions as WebpackWatchOptions } from 'webpack'

export type NuxtConfigurationWatchers = {
  chokidar?: ChokidarWatchOptions
  webpack?: WebpackWatchOptions
}
