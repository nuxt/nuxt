/* eslint-disable no-useless-constructor */
/*
The MIT License (MIT)

Copyright (c) 2019 Damon Oehlman <damon.oehlman@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import process from 'node:process'

export type DetectedInfoType =
    | 'browser'
    | 'node'
    | 'bot-device'
    | 'bot'
    | 'react-native'

export type Browser =
  | 'aol'
  | 'arc'
  | 'brave'
  | 'edge'
  | 'edge-ios'
  | 'yandexbrowser'
  | 'kakaotalk'
  | 'samsung'
  | 'silk'
  | 'miui'
  | 'beaker'
  | 'edge-chromium'
  | 'chrome'
  | 'chromium-webview'
  | 'phantomjs'
  | 'crios'
  | 'firefox'
  | 'fxios'
  | 'opera-mini'
  | 'opera'
  | 'pie'
  | 'netfront'
  | 'ie'
  | 'bb10'
  | 'android'
  | 'ios'
  | 'safari'
  | 'facebook'
  | 'instagram'
  | 'ios-webview'
  | 'curl'
  | 'searchbot'
export type OperatingSystem =
  | 'iOS'
  | 'Android OS'
  | 'BlackBerry OS'
  | 'Windows Mobile'
  | 'Amazon OS'
  | 'Windows 3.11'
  | 'Windows 95'
  | 'Windows 98'
  | 'Windows 2000'
  | 'Windows XP'
  | 'Windows Server 2003'
  | 'Windows Vista'
  | 'Windows 7'
  | 'Windows 8'
  | 'Windows 8.1'
  | 'Windows 10'
  | 'Windows ME'
  | 'Windows CE'
  | 'Open BSD'
  | 'Sun OS'
  | 'Linux'
  | 'Mac OS'
  | 'QNX'
  | 'BeOS'
  | 'OS/2'
  | 'Chrome OS'
type UserAgentRule = [Browser, RegExp]
type UserAgentMatch = [Browser, RegExpExecArray] | false
type OperatingSystemRule = [OperatingSystem, RegExp]

interface DetectedInfo<
    T extends DetectedInfoType, N extends string, O, V = null,
> {
  readonly type: T
  readonly name: N
  readonly version: V
  readonly os: O
}

export class BrowserInfo
implements DetectedInfo<'browser', Browser, OperatingSystem | null, string> {
  public readonly type = 'browser'
  constructor (
    public readonly name: Browser,
    public readonly version: string,
    public readonly os: OperatingSystem | null
  ) {}
}

export class NodeInfo
implements DetectedInfo<'node', 'node', NodeJS.Platform, string> {
  public readonly type = 'node'
  public readonly name = 'node' as const
  public readonly os: NodeJS.Platform = process.platform

  constructor (public readonly version: string) {}
}

export class SearchBotDeviceInfo
implements
        DetectedInfo<'bot-device', Browser, OperatingSystem | null, string> {
  public readonly type = 'bot-device'
  constructor (
    public readonly name: Browser,
    public readonly version: string,
    public readonly os: OperatingSystem | null,
    public readonly bot: string
  ) {}
}

export class BotInfo implements DetectedInfo<'bot', 'bot', null, null> {
  public readonly type = 'bot'
  public readonly bot = true as const // NOTE: deprecated test name instead
  public readonly name = 'bot' as const
  public readonly version: null = null
  public readonly os: null = null
}

export class ReactNativeInfo
implements DetectedInfo<'react-native', 'react-native', null, null> {
  public readonly type = 'react-native'
  public readonly name = 'react-native' as const
  public readonly version: null = null
  public readonly os: null = null
}

// tslint:disable-next-line:max-line-length
const SEARCHBOX_UA_REGEX = /alexa|bot|crawl(er|ing)|facebookexternalhit|feedburner|google web preview|nagios|postrank|pingdom|slurp|spider|yahoo!|yandex/
const SEARCHBOT_OS_REGEX = /(nuhk|curl|Googlebot|Yammybot|Openbot|Slurp|MSNBot|Ask Jeeves\/Teoma|ia_archiver)/
const REQUIRED_VERSION_PARTS = 3

const userAgentRules: UserAgentRule[] = [
  ['aol', /AOLShield\/([0-9._]+)/],
  ['brave', /Brave\/([0-9._]+)/],
  ['edge', /Edge\/([0-9._]+)/],
  ['edge-ios', /EdgiOS\/([0-9._]+)/],
  ['yandexbrowser', /YaBrowser\/([0-9._]+)/],
  ['kakaotalk', /KAKAOTALK\s([0-9.]+)/],
  ['samsung', /SamsungBrowser\/([0-9.]+)/],
  ['silk', /\bSilk\/([0-9._-]+)\b/],
  ['miui', /MiuiBrowser\/([0-9.]+)$/],
  ['beaker', /BeakerBrowser\/([0-9.]+)/],
  ['edge-chromium', /EdgA?\/([0-9.]+)/],
  [
    'chromium-webview',
    /(?!Chrom.*OPR)wv\).*Chrom(?:e|ium)\/([0-9.]+)(:?\s|$)/
  ],
  ['chrome', /(?!Chrom.*OPR)Chrom(?:e|ium)\/([0-9.]+)(:?\s|$)/],
  ['phantomjs', /PhantomJS\/([0-9.]+)(:?\s|$)/],
  ['crios', /CriOS\/([0-9.]+)(:?\s|$)/],
  ['firefox', /Firefox\/([0-9.]+)(?:\s|$)/],
  ['fxios', /FxiOS\/([0-9.]+)/],
  ['opera-mini', /Opera Mini.*Version\/([0-9.]+)/],
  ['opera', /Opera\/([0-9.]+)(?:\s|$)/],
  ['opera', /OPR\/([0-9.]+)(:?\s|$)/],
  ['pie', /^Microsoft Pocket Internet Explorer\/(\d+\.\d+)$/],
  ['pie', /^Mozilla\/\d\.\d+\s\(compatible;\s(?:MSP?IE|MSInternet Explorer) (\d+\.\d+);.*Windows CE.*\)$/],
  ['netfront', /^Mozilla\/\d\.\d+.*NetFront\/(\d.\d)/],
  ['ie', /Trident\/7\.0.*rv:([0-9.]+).*\).*Gecko$/],
  ['ie', /MSIE\s([0-9.]+);.*Trident\/[4-7].0/],
  ['ie', /MSIE\s(7\.0)/],
  ['bb10', /BB10;\sTouch.*Version\/([0-9.]+)/],
  ['android', /Android\s([0-9.]+)/],
  ['ios', /Version\/([0-9._]+).*Mobile.*Safari.*/],
  ['safari', /Version\/([0-9._]+).*Safari/],
  ['facebook', /FB[AS]V\/([0-9.]+)/],
  ['instagram', /Instagram\s([0-9.]+)/],
  ['ios-webview', /AppleWebKit\/([0-9.]+).*Mobile/],
  ['ios-webview', /AppleWebKit\/([0-9.]+).*Gecko\)$/],
  ['curl', /^curl\/([0-9.]+)$/],
  ['searchbot', SEARCHBOX_UA_REGEX]
]
const operatingSystemRules: OperatingSystemRule[] = [
  ['iOS', /iP(hone|od|ad)/],
  ['Android OS', /Android/],
  ['BlackBerry OS', /BlackBerry|BB10/],
  ['Windows Mobile', /IEMobile/],
  ['Amazon OS', /Kindle/],
  ['Windows 3.11', /Win16/],
  ['Windows 95', /(Windows 95)|(Win95)|(Windows_95)/],
  ['Windows 98', /(Windows 98)|(Win98)/],
  ['Windows 2000', /(Windows NT 5.0)|(Windows 2000)/],
  ['Windows XP', /(Windows NT 5.1)|(Windows XP)/],
  ['Windows Server 2003', /(Windows NT 5.2)/],
  ['Windows Vista', /(Windows NT 6.0)/],
  ['Windows 7', /(Windows NT 6.1)/],
  ['Windows 8', /(Windows NT 6.2)/],
  ['Windows 8.1', /(Windows NT 6.3)/],
  ['Windows 10', /(Windows NT 10.0)/],
  ['Windows ME', /Windows ME/],
  ['Windows CE', /Windows CE|WinCE|Microsoft Pocket Internet Explorer/],
  ['Open BSD', /OpenBSD/],
  ['Sun OS', /SunOS/],
  ['Chrome OS', /CrOS/],
  ['Linux', /(Linux)|(X11)/],
  ['Mac OS', /(Mac_PowerPC)|(Macintosh)/],
  ['QNX', /QNX/],
  ['BeOS', /BeOS/],
  ['OS/2', /OS\/2/]
]

export function detect (
  userAgent?: string
):
  | BrowserInfo
  | SearchBotDeviceInfo
  | BotInfo
  | NodeInfo
  | ReactNativeInfo
  | null {
  if (userAgent) { return parseUserAgent(userAgent) }

  if (
    typeof document === 'undefined' &&
        typeof navigator !== 'undefined' &&
        navigator.product === 'ReactNative'
  ) { return new ReactNativeInfo() }

  if (typeof navigator !== 'undefined') { return parseUserAgent(navigator.userAgent) }

  return getNodeVersion()
}

function matchUserAgent (ua: string): UserAgentMatch {
  // opted for using reduce here rather than Array#first with a regex.test call
  // this is primarily because using the reduce we only perform the regex
  // execution once rather than once for the test and for the exec again below
  // probably something that needs to be benchmarked though
  return (
    ua !== '' &&
        userAgentRules.reduce<UserAgentMatch>(
          (matched: UserAgentMatch, [browser, regex]) => {
            if (matched) { return matched }

            const uaMatch = regex.exec(ua)
            return !!uaMatch && [browser, uaMatch]
          },
          false
        )
  )
}

export function browserName (ua: string): Browser | null {
  const data = matchUserAgent(ua)
  return data ? data[0] : null
}

export function parseUserAgent (
  ua: string
): BrowserInfo | SearchBotDeviceInfo | BotInfo | null {
  const matchedRule: UserAgentMatch = matchUserAgent(ua)

  if (!matchedRule) { return null }

  const [name, match] = matchedRule
  if (name === 'searchbot') { return new BotInfo() }

  // Do not use RegExp for split operation as some browser do not support it (See: http://blog.stevenlevithan.com/archives/cross-browser-split)
  let versionParts = match[1] && match[1].split('.').join('_').split('_').slice(0, 3)
  if (versionParts) {
    if (versionParts.length < REQUIRED_VERSION_PARTS) {
      versionParts = [
        ...versionParts,
        ...createVersionParts(REQUIRED_VERSION_PARTS - versionParts.length)
      ]
    }
  } else {
    versionParts = []
  }

  const version = versionParts.join('.')
  const os = detectOS(ua)
  const searchBotMatch = SEARCHBOT_OS_REGEX.exec(ua)

  if (searchBotMatch && searchBotMatch[1]) { return new SearchBotDeviceInfo(name, version, os, searchBotMatch[1]) }

  return new BrowserInfo(name, version, os)
}

export function detectOS (ua: string): OperatingSystem | null {
  for (let ii = 0, count = operatingSystemRules.length; ii < count; ii++) {
    const [os, regex] = operatingSystemRules[ii]
    const match = regex.exec(ua)
    if (match) { return os }
  }

  return null
}

export function getNodeVersion (): NodeInfo | null {
  const isNode = typeof process !== 'undefined' && process.version
  return isNode ? new NodeInfo(process.version.slice(1)) : null
}

function createVersionParts (count: number): string[] {
  const output = []
  for (let ii = 0; ii < count; ii++) { output.push('0') }

  return output
}
