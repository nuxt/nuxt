/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
import fs from 'fs'
import path from 'path'
import { execSync, execFileSync } from 'child_process'
import isWsl from 'is-wsl'
import consola from 'consola'
import uniq from 'lodash/uniq'

const newLineRegex = /\r?\n/

/**
 * This class is based on node-get-chrome
 * https://github.com/mrlee23/node-get-chrome
 * https://github.com/gwuhaolin/chrome-finder
 */
export default class ChromeDetector {
  constructor () {
    this.platform = isWsl ? 'wsl' : process.platform
  }

  detect (platform = this.platform) {
    const handler = this[platform]
    if (typeof handler !== 'function') {
      throw new TypeError(`${platform} is not supported.`)
    }
    return this[platform]()[0]
  }

  darwin () {
    const suffixes = [
      '/Contents/MacOS/Chromium',
      '/Contents/MacOS/Google Chrome Canary',
      '/Contents/MacOS/Google Chrome'
    ]
    const LSREGISTER =
      '/System/Library/Frameworks/CoreServices.framework' +
      '/Versions/A/Frameworks/LaunchServices.framework' +
      '/Versions/A/Support/lsregister'
    const installations = []
    const customChromePath = this.resolveChromePath()
    if (customChromePath) {
      installations.push(customChromePath)
    }
    execSync(
      `${LSREGISTER} -dump` +
      " | grep -E -i -o '/.+(google chrome( canary)?|chromium)\\.app(\\s|$)'" +
      " | grep -E -v 'Caches|TimeMachine|Temporary|/Volumes|\\.Trash'"
    )
      .toString()
      .split(newLineRegex)
      .forEach((inst) => {
        suffixes.forEach((suffix) => {
          const execPath = path.join(inst.trim(), suffix)
          if (this.canAccess(execPath)) {
            installations.push(execPath)
          }
        })
      })
    // Retains one per line to maintain readability.
    // clang-format off
    const priorities = [
      { regex: new RegExp(`^${process.env.HOME}/Applications/.*Chrome.app`), weight: 50 },
      { regex: new RegExp(`^${process.env.HOME}/Applications/.*Chrome Canary.app`), weight: 51 },
      { regex: new RegExp(`^${process.env.HOME}/Applications/.*Chromium.app`), weight: 52 },
      { regex: /^\/Applications\/.*Chrome.app/, weight: 100 },
      { regex: /^\/Applications\/.*Chrome Canary.app/, weight: 101 },
      { regex: /^\/Applications\/.*Chromium.app/, weight: 102 },
      { regex: /^\/Volumes\/.*Chrome.app/, weight: -3 },
      { regex: /^\/Volumes\/.*Chrome Canary.app/, weight: -2 },
      { regex: /^\/Volumes\/.*Chromium.app/, weight: -1 }
    ]
    if (process.env.LIGHTHOUSE_CHROMIUM_PATH) {
      priorities.push({ regex: new RegExp(process.env.LIGHTHOUSE_CHROMIUM_PATH), weight: 150 })
    }
    if (process.env.CHROME_PATH) {
      priorities.push({ regex: new RegExp(process.env.CHROME_PATH), weight: 151 })
    }
    // clang-format on
    return this.sort(installations, priorities)
  }

  /**
   * Look for linux executables in 3 ways
   * 1. Look into CHROME_PATH env variable
   * 2. Look into the directories where .desktop are saved on gnome based distro's
   * 3. Look for google-chrome-stable & google-chrome executables by using the which command
   */
  linux () {
    let installations = []
    // 1. Look into CHROME_PATH env variable
    const customChromePath = this.resolveChromePath()
    if (customChromePath) {
      installations.push(customChromePath)
    }
    // 2. Look into the directories where .desktop are saved on gnome based distro's
    const desktopInstallationFolders = [
      path.join(require('os').homedir(), '.local/share/applications/'),
      '/usr/share/applications/'
    ]
    desktopInstallationFolders.forEach((folder) => {
      installations = installations.concat(this.findChromeExecutables(folder))
    })
    // Look for chromium(-browser) & google-chrome(-stable) executables by using the which command
    const executables = [
      'chromium-browser',
      'chromium',
      'google-chrome-stable',
      'google-chrome'
    ]
    executables.forEach((executable) => {
      try {
        const chromePath = execFileSync('which', [executable])
          .toString()
          .split(newLineRegex)[0]
        if (this.canAccess(chromePath)) {
          installations.push(chromePath)
        }
      } catch (e) {
        // Not installed.
      }
    })
    if (!installations.length) {
      throw new Error(
        'The environment variable CHROME_PATH must be set to ' +
          'executable of a build of Chromium version 54.0 or later.'
      )
    }
    const priorities = [
      { regex: /chromium-browser$/, weight: 51 },
      { regex: /chromium$/, weight: 50 },
      { regex: /chrome-wrapper$/, weight: 49 },
      { regex: /google-chrome-stable$/, weight: 48 },
      { regex: /google-chrome$/, weight: 47 }
    ]
    if (process.env.LIGHTHOUSE_CHROMIUM_PATH) {
      priorities.push({
        regex: new RegExp(process.env.LIGHTHOUSE_CHROMIUM_PATH),
        weight: 100
      })
    }
    if (process.env.CHROME_PATH) {
      priorities.push({ regex: new RegExp(process.env.CHROME_PATH), weight: 101 })
    }
    return this.sort(uniq(installations.filter(Boolean)), priorities)
  }

  wsl () {
    // Manually populate the environment variables assuming it's the default config
    process.env.LOCALAPPDATA = this.getLocalAppDataPath(process.env.PATH)
    process.env.PROGRAMFILES = '/mnt/c/Program Files'
    process.env['PROGRAMFILES(X86)'] = '/mnt/c/Program Files (x86)'
    return this.win32()
  }

  win32 () {
    const installations = []
    const sep = path.sep
    const suffixes = [
      `${sep}Chromium${sep}Application${sep}chrome.exe`,
      `${sep}Google${sep}Chrome SxS${sep}Application${sep}chrome.exe`,
      `${sep}Google${sep}Chrome${sep}Application${sep}chrome.exe`,
      `${sep}chrome-win32${sep}chrome.exe`,
      `${sep}Google${sep}Chrome Beta${sep}Application${sep}chrome.exe`
    ]
    const prefixes = [
      process.env.LOCALAPPDATA,
      process.env.PROGRAMFILES,
      process.env['PROGRAMFILES(X86)']
    ].filter(Boolean)
    const customChromePath = this.resolveChromePath()
    if (customChromePath) {
      installations.push(customChromePath)
    }
    prefixes.forEach(prefix =>
      suffixes.forEach((suffix) => {
        const chromePath = path.join(prefix, suffix)
        if (this.canAccess(chromePath)) {
          installations.push(chromePath)
        }
      })
    )
    return installations
  }

  resolveChromePath () {
    if (this.canAccess(process.env.CHROME_PATH)) {
      return process.env.CHROME_PATH
    }
    if (this.canAccess(process.env.LIGHTHOUSE_CHROMIUM_PATH)) {
      consola.warn(
        'ChromeLauncher',
        'LIGHTHOUSE_CHROMIUM_PATH is deprecated, use CHROME_PATH env variable instead.'
      )
      return process.env.LIGHTHOUSE_CHROMIUM_PATH
    }
  }

  getLocalAppDataPath (path) {
    const userRegExp = /\/mnt\/([a-z])\/Users\/([^/:]+)\/AppData\//
    const results = userRegExp.exec(path) || []
    return `/mnt/${results[1]}/Users/${results[2]}/AppData/Local`
  }

  sort (installations, priorities) {
    const defaultPriority = 10
    return installations
      .map((inst) => {
        for (const pair of priorities) {
          if (pair.regex.test(inst)) {
            return { path: inst, weight: pair.weight }
          }
        }
        return { path: inst, weight: defaultPriority }
      })
      .sort((a, b) => b.weight - a.weight)
      .map(pair => pair.path)
  }

  canAccess (file) {
    if (!file) {
      return false
    }
    try {
      fs.accessSync(file)
      return true
    } catch (e) {
      return false
    }
  }

  findChromeExecutables (folder) {
    const argumentsRegex = /(^[^ ]+).*/ // Take everything up to the first space
    const chromeExecRegex = '^Exec=/.*/(google-chrome|chrome|chromium)-.*'
    const installations = []
    if (this.canAccess(folder)) {
      // Output of the grep & print looks like:
      //    /opt/google/chrome/google-chrome --profile-directory
      //    /home/user/Downloads/chrome-linux/chrome-wrapper %U
      let execPaths
      // Some systems do not support grep -R so fallback to -r.
      // See https://github.com/GoogleChrome/chrome-launcher/issues/46 for more context.
      try {
        execPaths = execSync(
          `grep -ER "${chromeExecRegex}" ${folder} | awk -F '=' '{print $2}'`
        )
      } catch (e) {
        execPaths = execSync(
          `grep -Er "${chromeExecRegex}" ${folder} | awk -F '=' '{print $2}'`
        )
      }
      execPaths = execPaths
        .toString()
        .split(newLineRegex)
        .map(execPath => execPath.replace(argumentsRegex, '$1'))
      execPaths.forEach(
        execPath => this.canAccess(execPath) && installations.push(execPath)
      )
    }
    return installations
  }
}
