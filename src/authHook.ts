import { Configuration, miscUtils } from "@yarnpkg/core";
import { npmConfigUtils } from "@yarnpkg/plugin-npm";
import {
  getRegistryTypeForCommand,
  AuthorizationTokenParams,
  parseRegistryUrl,
  buildPluginConfig,
  PluginConfig,
  PluginRegistryConfig,
  getDefaultPluginRegistryConfig,
  getPluginRegistryConfig,
  getScopePluginRegistryConfig,
} from "./utils";
import { Codeartifact } from "@aws-sdk/client-codeartifact";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { fromEnv } from "@aws-sdk/credential-provider-env";
import { chain } from "@aws-sdk/property-provider";

type RegistryConfigMap = Map<string, string | boolean>;
type TokenGenerator = (
  authorizationTokenParams: AuthorizationTokenParams,
  pluginRegistryConfig: PluginRegistryConfig | null
) => Promise<string>;

/**
 * Patch `Configuration.find` to call `maybeSetAuthToken`
 * Use `Configuration.find` for now because it is called on all commands
 * TODO Use an appropriate plugin hook when one becomes available (https://github.com/yarnpkg/berry/issues/2067)
 */
const _originalConfigurationFind = Configuration.find;
Configuration.find = async function find(...args) {
  const configuration = await _originalConfigurationFind(...args);
  await maybeSetAuthToken({ configuration });
  return configuration;
};

/**
 * For all AWS CodeArtifact registries in the configuration, set an auth token on the registry if:
 * - we recognize the registry as an AWS CodeArtifact registry
 * - AND an auth token is not already set for that registry
 * - AND we recognize the `yarn` command as one requiring a registry
 *
 * @param {Configuration} configuration - Yarn configuration
 * @returns {Promise<void>}
 */
const maybeSetAuthToken = async ({
  configuration,
}: {
  configuration: Configuration;
}) => {
  const registryType: npmConfigUtils.RegistryType | null = getRegistryTypeForCommand();
  // not a command that requires a registry
  if (registryType === null) return;

  await maybeSetAuthorizationTokensForRegistries(
    configuration,
    registryType,
    getAuthorizationToken
  );
};

/**
 * Retrieve an authorization token from AWS CodeArtifact
 *
 * @param {AuthorizationTokenParams} authorizationTokenParams - Parameters required to retrieve a token from AWS CodeArtifact (https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CodeArtifact.html#getAuthorizationToken-property)
 * @param {PluginRegistryConfig | null} pluginRegistryConfig - Configuration of this registry instance for the AWS SDK
 * @returns {Promise<string>} Authorization token retrieved from AWS CodeArtifact
 */
const getAuthorizationToken = async (
  authorizationTokenParams: AuthorizationTokenParams,
  pluginRegistryConfig: PluginRegistryConfig | null
): Promise<string> => {
  const { domain, domainOwner, region } = authorizationTokenParams;
  const {
    awsProfile,
    preferAwsEnvironmentCredentials,
  } = pluginRegistryConfig || {
    awsProfile: undefined,
    preferAwsEnvironmentCredentials: false,
  };

  // for testing purposes only
  if (process.env._YARN_PLUGIN_AWS_CODEARTIFACT_TESTING) {
    return [
      "~~",
      domain,
      domainOwner,
      region,
      awsProfile,
      preferAwsEnvironmentCredentials,
      "~~",
    ].join("~");
  }

  const _defaultProvider = defaultProvider({
    // `awsProfile` that is any value (including `null` and `''`) should be provided as-is
    // `awsProfile` that is `undefined` should be excluded
    ...(awsProfile !== undefined ? { profile: awsProfile } : {}),
  });

  const credentials = miscUtils.parseBoolean(preferAwsEnvironmentCredentials)
    ? chain(fromEnv(), _defaultProvider)
    : _defaultProvider;

  const client = new Codeartifact({
    region,
    credentials,
  });
  const params = {
    domain,
    domainOwner,
    // this should be more than enough time to complete the command
    // we are not persisting this token anywhere once the command is complete
    // https://docs.aws.amazon.com/codeartifact/latest/APIReference/API_GetAuthorizationToken.html#API_GetAuthorizationToken_RequestSyntax
    durationSeconds: 900, // 15 minutes
  };
  const { authorizationToken } = await client.getAuthorizationToken(params);
  return authorizationToken;
};

/**
 * For all unique AWS CodeArtifact registries in the configuration, generate an authorization token and put it in the configuration
 *
 * @param {Configuration} configuration - Yarn configuration
 * @param {npmConfigUtils.RegistryType} registryType - Type of registry (`npmRegistryServer` or `npmPublishRegistry`)
 * @param {TokenGenerator} tokenGenerator - Function that generates authorization tokens
 * @returns {Promise<void>}
 */
export const maybeSetAuthorizationTokensForRegistries = async (
  configuration: Configuration,
  registryType: npmConfigUtils.RegistryType,
  tokenGenerator: TokenGenerator
): Promise<void> => {
  const pluginConfig: PluginConfig = await buildPluginConfig(
    configuration.startingCwd
  );

  // default registry
  const defaultRegistry: string = npmConfigUtils.getDefaultRegistry({
    configuration,
    type: registryType,
  });
  const defaultPluginRegistryConfig: PluginRegistryConfig | null = getDefaultPluginRegistryConfig(
    pluginConfig,
    registryType
  );
  await maybeSetAuthorizationTokenForRegistry(
    defaultRegistry,
    defaultPluginRegistryConfig,
    configuration.values,
    tokenGenerator
  );

  // `npmRegistries` map
  // we don't know which ones might be used, so authenticate all of them
  const npmRegistriesMap: Map<
    string,
    RegistryConfigMap
  > = configuration.values.get("npmRegistries");
  for (const [
    npmRegistriesKey,
    registryConfigMap,
  ] of npmRegistriesMap.entries()) {
    // registries without a protocol are supported here
    // normalize these by adding a protocol and removing the trailing slash
    const registry = npmRegistriesKey.startsWith("//")
      ? `https:${npmRegistriesKey}`
      : npmRegistriesKey;
    const pluginRegistryConfig: PluginRegistryConfig | null = getPluginRegistryConfig(
      npmRegistriesKey,
      pluginConfig
    );
    await maybeSetAuthorizationTokenForRegistry(
      npmConfigUtils.normalizeRegistry(registry),
      pluginRegistryConfig,
      registryConfigMap,
      tokenGenerator
    );
  }

  // `npmScopes` map
  // we don't know which ones might be used, so authenticate all of them
  const npmScopesMap: Map<string, RegistryConfigMap> = configuration.values.get(
    "npmScopes"
  );
  for (const [scope, registryConfigMap] of npmScopesMap.entries()) {
    const registry = npmConfigUtils.getScopeRegistry(scope, {
      configuration,
      type: registryType,
    });
    const pluginRegistryConfig: PluginRegistryConfig | null = getScopePluginRegistryConfig(
      scope,
      pluginConfig,
      registryType
    );
    await maybeSetAuthorizationTokenForRegistry(
      registry,
      pluginRegistryConfig,
      registryConfigMap,
      tokenGenerator
    );
  }
};

/**
 * Map that stores mappings of (registry + plugin registry configuration) -> authToken
 */
const authTokenMap: Map<string, string> = new Map();

/**
 * For a given registry, if it's an AWS CodeArtifact registry, generate an authorization token if we haven't already generated one for this registry, and set it in the configuration
 *
 * @param {string} registry - NPM Registry URL
 * @param {PluginRegistryConfig} pluginRegistryConfig - Configuration of this registry instance for the AWS SDK
 * @param {RegistryConfigMap} registryConfigMap - Registry configuration map from Yarn configuration
 * @param {TokenGenerator} tokenGenerator - Function that generates authorization tokens
 * @returns {Promise<void>}
 */
const maybeSetAuthorizationTokenForRegistry = async (
  registry: string,
  pluginRegistryConfig: PluginRegistryConfig | null,
  registryConfigMap: RegistryConfigMap,
  tokenGenerator: TokenGenerator
): Promise<void> => {
  // skip this registry configuration if it already has a token set
  if (registryConfigMap.get("npmAuthToken")) return;

  const authTokenMapKey = JSON.stringify({
    registry,
    ...(pluginRegistryConfig || {}),
  });

  // don't bother retrieving an auth token if we already have one for this registry and profile
  if (!authTokenMap.has(authTokenMapKey)) {
    const authorizationTokenParams: AuthorizationTokenParams | null = parseRegistryUrl(
      registry
    );
    // not an AWS CodeArtifact registry
    if (authorizationTokenParams === null) return;

    const authorizationToken: string = await tokenGenerator(
      authorizationTokenParams,
      pluginRegistryConfig
    );

    if (process.env._YARN_PLUGIN_AWS_CODEARTIFACT_DEBUG) {
      // TODO use a LightReport to write this to STDOUT, being careful to check for the `--json` flag from the user
      console.log(
        `_YARN_PLUGIN_AWS_CODEARTIFACT_DEBUG: Setting token for registry ${registry} with config ${JSON.stringify(
          pluginRegistryConfig
        )} to ${authorizationToken}`
      );
    }

    // stash the token so we can re-use if we encounter this registry again
    authTokenMap.set(authTokenMapKey, authorizationToken);
  }

  setAuthConfiguration(
    registryConfigMap,
    authTokenMap.get(authTokenMapKey) as string
  );
};

/**
 * Set an authorization token into a registry configuration
 *
 * @param {RegistryConfigMap} registryConfigMap - Registry configuration map from Yarn configuration
 * @param {string} authorizationToken - Authorization token retrieved from AWS CodeArtifact
 * @returns {void}
 */
const setAuthConfiguration = (
  registryConfigMap: RegistryConfigMap,
  authorizationToken: string
) => {
  // set these values in memory, to be used by Yarn
  registryConfigMap.set("npmAlwaysAuth", true);
  registryConfigMap.set("npmAuthToken", authorizationToken);
};
