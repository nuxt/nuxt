import destr from 'destr'

const runtimeConfig = process.env.RUNTIME_CONFIG

for (const type of ['private', 'public']) {
  for (const key in runtimeConfig[type]) {
    runtimeConfig[type][key] = destr(process.env[key] || runtimeConfig[type][key])
  }
}

const $config = global.$config = {
  ...runtimeConfig.public,
  ...runtimeConfig.private
}

export default {
  public: runtimeConfig.public,
  private: $config
}
