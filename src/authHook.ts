import { Configuration, miscUtils, Ident } from '@yarnpkg/core'
import { npmConfigUtils } from '@yarnpkg/plugin-npm'
import { npath, PortablePath } from '@yarnpkg/fslib'
import { execute } from '@yarnpkg/shell'
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
import { decorateDefaultCredentialProvider } from '@aws-sdk/client-sts'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { fromEnv } from '@aws-sdk/credential-provider-env'
import { chain } from '@aws-sdk/property-provider'
import process from 'process'

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
  if (shouldSkipPlugin()) return skipPlugin()

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
    const { awsProfile, preferAwsEnvironmentCredentials, preAuthCommand } = pluginRegistryConfig || {
      awsProfile: undefined,
      preferAwsEnvironmentCredentials: false
    }

    if (preAuthCommand) {
      // `preAuthCommand` was turned into JSON as part of `buildPluginConfig`
      const { command, cwd } = JSON.parse(preAuthCommand)
      const exitCode = await execute(command, [], { cwd })
      if (exitCode) {
        throw new Error('The `preAuthCommand` failed, see output above.')
      }
    }

    // for testing purposes only
    if (process.env._YARN_PLUGIN_AWS_CODEARTIFACT_TESTING) {
      const testAuthorizationToken = [
        '~~',
        domain,
        domainOwner,
        region,
        awsProfile,
        preferAwsEnvironmentCredentials,
        '~~'
      ].join('~')

      console.log(
        `_YARN_PLUGIN_AWS_CODEARTIFACT_TESTING: Retrieved token for authorization parameters ${JSON.stringify(
          authorizationTokenParams
        )} with config ${JSON.stringify(pluginRegistryConfig)}: ${testAuthorizationToken}`
      )

      return testAuthorizationToken
    }

    const _defaultProvider = decorateDefaultCredentialProvider(defaultProvider)({
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
    const authorizationToken = (await client.getAuthorizationToken(params)).authorizationToken

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
 * @returns {PortablePath} Starting directory for searching for plugin configuration files
 */
export const getPluginConfigStartingCwd = (configuration: Configuration): PortablePath => {
  // for `dlx` commands, `configuration.startingCwd` will be a temporary directory (not the project directory)
  // the temporary directory contains a copy of the project's `.yarnrc.yml` file but does not contain the plugin configuration file
  // in that case, use `process.cwd()` so we start looking for plugin configuration files from where the command is run
  // https://github.com/yarnpkg/berry/blob/4f88b35c90695fb83c296b57f64cbf8dd2f88a9a/packages/plugin-dlx/sources/commands/dlx.ts#L47
  const isDlx = !!configuration.projectCwd?.endsWith(`dlx-${process.pid}`)
  return isDlx ? npath.toPortablePath(process.cwd()) : configuration.startingCwd
}

// Dependabot relies on this env variable so it's existence points to the fact
// that we are running such an environment. See
// https://github.com/dependabot/dependabot-core/blob/23de1c7583117bd15f26ab33482383ed57208f14/updater/lib/dependabot/environment.rb#L6
//
// Dependabot doesn't support passing environment variables. We can only pass the
// token for the registry in a special dependabot.yaml config file. So this plugin
// will never work for it, just skip the token calculation and configure it separately.
const isRunningInDependabot = (): boolean => process.env.DEPENDABOT_JOB_ID !== undefined

// In some environments you may want to use an existing auth token instead of fetching a new one
// This is an escape hatch for that case
const useExistingAuthtoken = (): boolean => process.env._YARN_PLUGIN_AWS_CODEARTIFACT_DISABLE !== undefined

const shouldSkipPlugin = (): boolean => isRunningInDependabot() || useExistingAuthtoken()

export const SKIP_PLUGIN_ERROR = 'CODEARTIFACT_AUTH_TOKEN is not set; cannot use _YARN_PLUGIN_AWS_CODEARTIFACT_DISABLE'
export const DEPENDABOT_DUMMY_TOKEN = 'dummy-token'
export const skipPlugin = () => {
  if (isRunningInDependabot()) {
    // return a dummy header to prevent `No authentication configured for request`
    // see https://github.com/yarnpkg/berry/blob/ad8c95d3bd597966b4669d5fff13a95deab550af/packages/plugin-npm/sources/npmHttpUtils.ts#L384
    // the dependabot proxy will replace the dummy header with a valid one before calling the registry
    return `Bearer ${DEPENDABOT_DUMMY_TOKEN}`
  }
  if (useExistingAuthtoken()) {
    const existingAuthToken = process.env.CODEARTIFACT_AUTH_TOKEN

    if (!existingAuthToken) throw new Error(SKIP_PLUGIN_ERROR)

    if (process.env._YARN_PLUGIN_AWS_CODEARTIFACT_TESTING) {
      console.log(`_YARN_PLUGIN_AWS_CODEARTIFACT_DISABLE: Use passed in token: ${existingAuthToken}`)
    }

    return `Bearer ${existingAuthToken}`
  }

  throw Error('This function should not be called if the plugin is not skipped')
}
