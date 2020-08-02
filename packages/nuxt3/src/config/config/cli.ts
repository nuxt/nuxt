import { Color } from 'chalk'

export interface CliOptions {
  badgeMessages: string[]
  bannerColor: typeof Color
}

export default (): CliOptions => ({
  badgeMessages: [],
  bannerColor: 'green'
})
