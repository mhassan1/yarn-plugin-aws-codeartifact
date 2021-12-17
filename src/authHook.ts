import { Configuration, miscUtils, Ident } from '@yarnpkg/core'
import { npmConfigUtils } from '@yarnpkg/plugin-npm'
import { npath, PortablePath } from '@yarnpkg/fslib'
import {
  getRegistryTypeForCommand,
  AuthorizationTokenParams,
  parseRegistryUrl,
  buildPluginConfig,
  memoizePromise,
  PluginConfig,
  PluginRegistryConfig,
  getDefaultPluginRegistryConfig,
  getPluginRegistryConfig,
  getScopePluginRegistryConfig
} from './utils'
import { Codeartifact } from '@aws-sdk/client-codeartifact'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { fromEnv } from '@aws-sdk/credential-provider-env'
import { chain } from '@aws-sdk/property-provider'

type TokenGenerator = (
  authorizationTokenParams: AuthorizationTokenParams,
  pluginRegistryConfig: PluginRegistryConfig | null
) => Promise<string>

/* istanbul ignore next */
/**
 * Yarn `getNpmAuthenticationHeader` hook
 * https://github.com/yarnpkg/berry/pull/2664
 *
 * @param {string | undefined} _currentHeader - Current header value
 * @param {string} registry - Registry URL
 * @param {{configuration: Configuration, ident: Ident}} context - Yarn configuration and package identifier
 * @returns {Promise<string | undefined>} Authentication header, if applicable
 */
export const getNpmAuthenticationHeader = async (
  _currentHeader: string | undefined,
  registry: string,
  { configuration, ident }: { configuration: Configuration; ident: Ident }
): Promise<string | undefined> => {
  const initializeResult = await initializePlugin(configuration)
  if (initializeResult === null) return

  const { pluginConfig, registryType } = initializeResult

  const authToken = await computeAuthToken(
    registry,
    ident?.scope || null,
    registryType,
    pluginConfig,
    getAuthorizationToken
  )
  if (authToken === null) return

  return `Bearer ${authToken}`
}

/* istanbul ignore next */
/**
 * Initialize the plugin as a singleton
 * This function is memoized and can be called repeatedly safely
 *
 * @param {Configuration} configuration - Yarn configuration
 * @returns {Promise<{ pluginConfig: PluginConfig, registryType: npmConfigUtils.RegistryType } | null>} - Plugin configuration, if found
 */
const initializePlugin = memoizePromise(
  async (
    configuration: Configuration
  ): Promise<{ pluginConfig: PluginConfig; registryType: npmConfigUtils.RegistryType } | null> => {
    const registryType = getRegistryTypeForCommand()
    if (registryType === null) return null

    const pluginConfigStartingCwd = getPluginConfigStartingCwd(configuration)

    const pluginConfig = await buildPluginConfig(pluginConfigStartingCwd)

    return { pluginConfig, registryType }
  },
  () => 'singleton'
)

/**
 * For a given registry and optional scope, compute an auth token for the registry if:
 * - we recognize the registry as an AWS CodeArtifact registry
 * - AND an auth token has not already been computed for that registry, scope, and type
 *
 * @param {string} registry - Registry URL
 * @param {string | null} scope - Package scope
 * @param {PluginConfig} pluginConfig - Package scope
 * @param {npmConfigUtils.RegistryType} registryType - Type of registry (`npmRegistryServer` or `npmPublishRegistry`)
 * @param {TokenGenerator} tokenGenerator - Function that generates authorization tokens
 * @returns {Promise<string | null>} Authorization token retrieved from AWS CodeArtifact, if applicable
 */
export const computeAuthToken = memoizePromise(
  async (
    registry: string,
    scope: string | null,
    registryType: npmConfigUtils.RegistryType,
    pluginConfig: PluginConfig,
    tokenGenerator: TokenGenerator
  ): Promise<string | null> => {
    const authorizationTokenParams: AuthorizationTokenParams | null = parseRegistryUrl(registry)

    // not an AWS CodeArtifact registry
    if (authorizationTokenParams === null) return null

    const pluginRegistryConfig =
      (scope && getScopePluginRegistryConfig(scope, pluginConfig, registryType)) ||
      getPluginRegistryConfig(registry, pluginConfig) ||
      getDefaultPluginRegistryConfig(pluginConfig, registryType)

    // no configuration found
    if (pluginRegistryConfig === null) return null

    return tokenGenerator(authorizationTokenParams, pluginRegistryConfig)
  },
  (registry, scope, registryType) => JSON.stringify({ registry, scope, registryType })
)

/* istanbul ignore next */
/**
 * Retrieve an authorization token from AWS CodeArtifact
 * This function is memoized
 *
 * @param {AuthorizationTokenParams} authorizationTokenParams - Parameters required to retrieve a token from AWS CodeArtifact (https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CodeArtifact.html#getAuthorizationToken-property)
 * @param {PluginRegistryConfig | null} pluginRegistryConfig - Configuration of this registry instance for the AWS SDK
 * @returns {Promise<string>} Authorization token retrieved from AWS CodeArtifact
 */
const getAuthorizationToken = memoizePromise(
  async (
    authorizationTokenParams: AuthorizationTokenParams,
    pluginRegistryConfig: PluginRegistryConfig | null
  ): Promise<string> => {
    const { domain, domainOwner, region } = authorizationTokenParams
    const { awsProfile, preferAwsEnvironmentCredentials } = pluginRegistryConfig || {
      awsProfile: undefined,
      preferAwsEnvironmentCredentials: false
    }

    let authorizationToken

    // for testing purposes only
    if (process.env._YARN_PLUGIN_AWS_CODEARTIFACT_TESTING) {
      authorizationToken = ['~~', domain, domainOwner, region, awsProfile, preferAwsEnvironmentCredentials, '~~'].join(
        '~'
      )
    } else {
      const _defaultProvider = defaultProvider({
        // `awsProfile` that is any value (including `null` and `''`) should be provided as-is
        // `awsProfile` that is `undefined` should be excluded
        ...(awsProfile !== undefined ? { profile: awsProfile } : {})
      })

      const credentials = miscUtils.parseOptionalBoolean(preferAwsEnvironmentCredentials)
        ? chain(fromEnv(), _defaultProvider)
        : _defaultProvider

      const client = new Codeartifact({
        region,
        credentials
      })
      const params = {
        domain,
        domainOwner,
        // this should be more than enough time to complete the command
        // we are not persisting this token anywhere once the command is complete
        // https://docs.aws.amazon.com/codeartifact/latest/APIReference/API_GetAuthorizationToken.html#API_GetAuthorizationToken_RequestSyntax
        durationSeconds: 900 // 15 minutes
      }
      authorizationToken = (await client.getAuthorizationToken(params)).authorizationToken
    }

    if (!authorizationToken) {
      throw new Error('AWS CodeArtifact Authorization token returned undefined')
    }

    if (process.env._YARN_PLUGIN_AWS_CODEARTIFACT_DEBUG) {
      // TODO use a LightReport to write this to STDOUT, being careful to check for the `--json` flag from the user
      console.log(
        `_YARN_PLUGIN_AWS_CODEARTIFACT_DEBUG: Retrieved token for authorization parameters ${JSON.stringify(
          authorizationTokenParams
        )} with config ${JSON.stringify(pluginRegistryConfig)}: ${authorizationToken}`
      )
    }

    return authorizationToken
  },
  (authorizationTokenParams, pluginRegistryConfig) => JSON.stringify({ authorizationTokenParams, pluginRegistryConfig })
)

/**
 * Determine the starting directory for searching for plugin configuration files
 *
 * @param {Configuration} configuration - Yarn configuration
 * @param {string[]} argv - CLI arguments
 * @returns {PortablePath} Starting directory for searching for plugin configuration files
 */
export const getPluginConfigStartingCwd = (
  configuration: Configuration,
  argv: string[] = process.argv.slice(2)
): PortablePath => {
  // for `dlx` commands, `configuration.startingCwd` will be a temporary directory (not the project directory)
  // the temporary directory contains a copy of the project's `.yarnrc.yml` file but does not contain the plugin configuration file
  // in that case, use `process.cwd()` so we start looking for plugin configuration files from where the command is run
  return argv[0] === 'dlx' ? npath.toPortablePath(process.cwd()) : configuration.startingCwd
}
