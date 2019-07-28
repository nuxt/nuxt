import crypto from 'crypto'

export const createMd5HashFromString = (string, length = 20) => {
  return crypto.createHash('md5').update(string).digest('hex').substr(0, length)
}

export const createTimeHash = () => createMd5HashFromString(new Date().toISOString())
