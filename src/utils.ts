import { folderUtils } from '@yarnpkg/core'
import { Filename, PortablePath, ppath, xfs, npath } from '@yarnpkg/fslib'
import { parseSyml } from '@yarnpkg/parsers'
import { npmConfigUtils } from '@yarnpkg/plugin-npm'
import parser from 'yargs-parser'
import { findRegistryCommand } from './registryCommands'
import defaultsDeep from 'lodash.defaultsdeep'
import get from 'lodash.get'

/**
 * Name of the plugin configuration file
 */
const pluginConfigFilename = '.yarn-plugin-aws-codeartifact.yml' as Filename

/**
 * Root directory of this plugin, for use in automated tests
 */
export const pluginRootDir: PortablePath =
  npath.basename(__dirname) === '@yarnpkg'
    ? // __dirname = `<rootDir>/bundles/@yarnpkg`
      ppath.join(npath.toPortablePath(__dirname), '../..' as PortablePath)
    : // __dirname = `<rootDir>/src`
      ppath.join(npath.toPortablePath(__dirname), '..' as PortablePath)

/**
 * Determine registry type for a `yarn` command
 * This is an imperfect way to check whether this command is a command that will need a registry, and which type of registry it is
 * TODO Once we have an appropriate hook, we should not need to do this
 *
 * @param {string[]} argv - CLI arguments
 * @returns {npmConfigUtils.RegistryType} Type of registry (`npmRegistryServer` or `npmPublishRegistry`)
 */
export const getRegistryTypeForCommand = (
  argv: string[] = process.argv.slice(2)
): npmConfigUtils.RegistryType | null => {
  const yargsParserOutput = parser(argv)
  const { _: positionalArgs } = yargsParserOutput

  // `yarn` by itself is the same as `yarn install`
  if (!positionalArgs.length) {
    positionalArgs.push('install')
  }

  let registryCommand = findRegistryCommand(positionalArgs)

  const { shiftPositionalArgs } = registryCommand || {}
  if (shiftPositionalArgs) {
    // shift `positionalArgs` and find the `registryCommand` again
    positionalArgs.splice(0, shiftPositionalArgs)
    registryCommand = findRegistryCommand(positionalArgs)
  }

  if (registryCommand === null) return null

  const { registryFn = () => npmConfigUtils.RegistryType.FETCH_REGISTRY } = registryCommand
  return registryFn(yargsParserOutput)
}

/**
 * Check whether an array starts with a list of items
 *
 * @param {Array} array - Array of any
 * @param {Array} items - Array of any
 * @returns {boolean} Whether array starts with items
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const arrayStartsWith = (array: any[], ...items: any[]): boolean => {
  for (let i = 0; i < items.length; i++) {
    if (array[i] !== items[i]) return false
  }
  return true
}

/**
 * Parse an AWS CodeArtifact registry URL into its parts
 *
 * @param {string} registry - AWS CodeArtifact Registry URL
 * @returns {AuthorizationTokenParams} Parameters that will be used to retrieve an AWS CodeArtifact authorization token
 */
export const parseRegistryUrl = (registry: string): AuthorizationTokenParams | null => {
  const match = registry.match(/^https?:\/\/(.+)-(\d+)\.d\.codeartifact\.(.+)\.amazonaws\.com\/npm\/(.+)\/?$/)

  if (!match) return null

  const [, domain, domainOwner, region]: string[] = match
  return { domain, domainOwner, region }
}

export type AuthorizationTokenParams = {
  domain: string
  domainOwner: string
  region: string
}

/**
 * Build plugin configuration object
 *
 * @param {PortablePath} startingCwd - Yarn configuration working directory
 * @returns {Promise<PluginConfig>} Plugin configuration
 */
export const buildPluginConfig = async (startingCwd: PortablePath): Promise<PluginConfig> => {
  const configFiles = await findPluginConfigFiles(startingCwd)
  const homeConfigFile = await findHomePluginConfigFile()
  if (homeConfigFile !== null) {
    configFiles.push(homeConfigFile)
  }
  const configData = configFiles
    .map(
      augmentConfigFile((pluginRegistryConfig, { cwd }) => {
        if (pluginRegistryConfig.skipCommand) {
          pluginRegistryConfig.skipCommand = JSON.stringify({
            command: pluginRegistryConfig.skipCommand,
            cwd
          })
        }

        if (pluginRegistryConfig.preAuthCommand) {
          pluginRegistryConfig.preAuthCommand = JSON.stringify({
            command: pluginRegistryConfig.preAuthCommand,
            cwd
          })
        }
      })
    )
    .map(({ data }) => data)
  return defaultsDeep({}, ...configData)
}

export type PluginConfig = {
  npmRegistryServerConfig?: PluginRegistryConfig
  npmPublishRegistryConfig?: PluginRegistryConfig
  npmScopes?: {
    [scope: string]: {
      npmRegistryServerConfig?: PluginRegistryConfig
      npmPublishRegistryConfig?: PluginRegistryConfig
    }
  }
  npmRegistries?: {
    [registry: string]: PluginRegistryConfig
  }
}

export type PluginRegistryConfig = {
  awsProfile: string
  // plugin configuration values are always interpreted as string
  preferAwsEnvironmentCredentials?: BooleanString
  skipCommand?: string
  preAuthCommand?: string
}

type BooleanString = 'true' | 'false'

/**
 * Traverse directories upwards looking for plugin configuration files (based on `Configuration.findRcFiles`)
 *
 * @param {PortablePath} startingCwd - Yarn configuration working directory
 * @returns {Promise<ConfigFile[]>} Array of configuration files in ancestor directories
 */
const findPluginConfigFiles = async (startingCwd: PortablePath): Promise<ConfigFile[]> => {
  const configFiles = []

  let nextCwd = startingCwd
  let currentCwd = null
  while (nextCwd !== currentCwd) {
    currentCwd = nextCwd

    const pluginConfigFile = await readPluginConfigFile(currentCwd)
    if (pluginConfigFile !== null) {
      configFiles.push(pluginConfigFile)
    }

    nextCwd = ppath.dirname(currentCwd)

    // do not traverse higher than this project's root directory in automated tests
    if (process.env._YARN_PLUGIN_AWS_CODEARTIFACT_TESTING && currentCwd === pluginRootDir) {
      break
    }
  }

  return configFiles
}

/**
 * Look for plugin configuration file in home directory (based on `Configuration.findHomeRcFile`)
 *
 * @returns {Promise<ConfigFile | null>} Configuration file in home directory
 */
const findHomePluginConfigFile = async (): Promise<ConfigFile | null> => {
  const homeFolder = process.env._YARN_PLUGIN_AWS_CODEARTIFACT_TESTING
    ? ppath.join(pluginRootDir, 'src/__tests__/integration/fixtures/home' as PortablePath)
    : folderUtils.getHomeFolder()

  return readPluginConfigFile(homeFolder)
}

/**
 * Read a plugin configuration file, if it exists
 *
 * @param {PortablePath} folder - Folder with configuration file
 * @returns {Promise<ConfigFile | null>} Plugin configuration file
 */
const readPluginConfigFile = async (folder: PortablePath): Promise<ConfigFile | null> => {
  const configFilePath = ppath.join(folder, pluginConfigFilename)
  if (xfs.existsSync(configFilePath)) {
    const content = await xfs.readFilePromise(configFilePath, `utf8`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = parseSyml(content) as any
    return { path: configFilePath, cwd: folder, data }
  }

  return null
}

type ConfigFile = {
  path: PortablePath
  cwd: PortablePath
  data: PluginConfig
}

/**
 * Compute plugin registry configuration key for a registry type
 *
 * @param {npmConfigUtils.RegistryType} type - Type of registry (`npmRegistryServer` or `npmPublishRegistry`)
 * @returns {string} - Plugin registry configuration key (`npmRegistryServerConfig` or `npmPublishRegistryConfig`)
 */
export const computePluginRegistryConfigKey = (type: npmConfigUtils.RegistryType): string => {
  return `${type}Config`
}

/**
 * Get default plugin registry configuration (based on logic in `npmConfigUtils.getDefaultRegistry`)
 *
 * @param {PluginConfig} pluginConfig - Plugin configuration
 * @param {npmConfigUtils.RegistryType} type - Type of registry (`npmRegistryServer` or `npmPublishRegistry`)
 * @returns {PluginRegistryConfig | null} Plugin registry configuration
 */
export const getDefaultPluginRegistryConfig = (
  pluginConfig: PluginConfig,
  type: npmConfigUtils.RegistryType
): PluginRegistryConfig | null => {
  return (
    get(pluginConfig, [computePluginRegistryConfigKey(type)]) ||
    get(pluginConfig, [computePluginRegistryConfigKey(npmConfigUtils.RegistryType.FETCH_REGISTRY)]) ||
    null
  )
}

/**
 * Get plugin registry configuration from `npmRegistries` (based on logic in `npmConfigUtils.getRegistryConfiguration`)
 *
 * @param {string} registry - AWS CodeArtifact Registry URL
 * @param {PluginConfig} pluginConfig - Plugin configuration
 * @returns {PluginRegistryConfig | null} Plugin registry configuration
 */
export const getPluginRegistryConfig = (registry: string, pluginConfig: PluginConfig): PluginRegistryConfig | null => {
  const normalizedRegistry = registry.replace(/\/$/, '')

  return (
    get(pluginConfig, ['npmRegistries', normalizedRegistry]) ||
    get(pluginConfig, ['npmRegistries', normalizedRegistry.replace(/^[a-z]+:/, '')]) ||
    null
  )
}

/**
 * Get scope plugin registry configuration (based on logic in `npmConfigUtils.getScopeRegistry`)
 *
 * @param {string} scope - Package scope
 * @param {PluginConfig} pluginConfig - Plugin configuration
 * @param {npmConfigUtils.RegistryType} type - Type of registry (`npmRegistryServer` or `npmPublishRegistry`)
 * @returns {PluginRegistryConfig | null} Plugin registry configuration
 */
export const getScopePluginRegistryConfig = (
  scope: string,
  pluginConfig: PluginConfig,
  type: npmConfigUtils.RegistryType
): PluginRegistryConfig | null => {
  const scopeConfig = get(pluginConfig, ['npmScopes', scope]) || null
  if (scopeConfig === null) return getDefaultPluginRegistryConfig(pluginConfig, type)
  return get(scopeConfig, [computePluginRegistryConfigKey(type)]) || getDefaultPluginRegistryConfig(pluginConfig, type)
}

/**
 * Memoize an async function
 *
 * @param {() => Promise} fn - Async function
 * @param {() => string} keyFn - Cache key generation function
 * @returns {() => Promise} Memoized async function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const memoizePromise = <T, F extends (...args: readonly any[]) => Promise<T>>(
  fn: F,
  keyFn: (...args: Parameters<F>) => string
): F => {
  const promiseCache = new Map<string, Promise<T>>()
  return ((...args: Parameters<F>) => {
    const key = keyFn(...args)

    if (promiseCache.has(key)) {
      return promiseCache.get(key)
    }

    const promise = fn(...args)
    promiseCache.set(key, promise)
    return promise
  }) as F
}

/**
 * Augment a config file via an `augment` callback
 *
 * @param {Function} augment Augment function
 * @returns {Function} Map functionConfigFile
 */
export const augmentConfigFile =
  (augment: (pluginRegistryConfig: PluginRegistryConfig, configFile: ConfigFile) => void) =>
  (configFile: ConfigFile): ConfigFile => {
    const pluginConfig = configFile.data
    if (pluginConfig.npmRegistryServerConfig) {
      augment(pluginConfig.npmRegistryServerConfig, configFile)
    }
    if (pluginConfig.npmPublishRegistryConfig) {
      augment(pluginConfig.npmPublishRegistryConfig, configFile)
    }
    if (pluginConfig.npmScopes) {
      Object.values(pluginConfig.npmScopes).forEach(({ npmRegistryServerConfig, npmPublishRegistryConfig }) => {
        if (npmRegistryServerConfig) augment(npmRegistryServerConfig, configFile)
        if (npmPublishRegistryConfig) augment(npmPublishRegistryConfig, configFile)
      })
    }
    if (pluginConfig.npmRegistries) {
      Object.values(pluginConfig.npmRegistries).forEach((pluginRegistryConfig) => {
        if (pluginRegistryConfig) augment(pluginRegistryConfig, configFile)
      })
    }
    return configFile
  }
