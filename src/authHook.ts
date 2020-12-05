import { Configuration } from "@yarnpkg/core";
import { npmConfigUtils } from "@yarnpkg/plugin-npm";
import {
  getRegistryTypeForCommand,
  AuthorizationTokenParams,
  parseRegistryUrl,
} from "./utils";
import { Codeartifact } from "@aws-sdk/client-codeartifact";

type RegistryConfigMap = Map<string, string | boolean>;

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
 * @param {Configuration} configuration
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
 * @param {string} domain
 * @param {string} domainOwner
 * @param {string} region
 * @returns {Promise<string>}
 */
const getAuthorizationToken = async ({
  domain,
  domainOwner,
  region,
}: AuthorizationTokenParams): Promise<string> => {
  // for testing purposes only
  if (process.env._YARN_PLUGIN_AWS_CODEARTIFACT_TESTING) {
    return ["~~", domain, domainOwner, region, "~~"].join("~");
  }

  const client = new Codeartifact({ region });
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
 * @param {Configuration} configuration
 * @param {npmConfigUtils.RegistryType} registryType
 * @param {(AuthorizationTokenParams) => Promise<string>} tokenGenerator
 * @returns {Promise<void>}
 */
export const maybeSetAuthorizationTokensForRegistries = async (
  configuration: Configuration,
  registryType: npmConfigUtils.RegistryType,
  tokenGenerator: (AuthorizationTokenParams) => Promise<string>
) => {
  // default registry
  const defaultRegistry: string = npmConfigUtils.getDefaultRegistry({
    configuration,
    type: registryType,
  });
  await maybeSetAuthorizationTokenForRegistry(
    defaultRegistry,
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
    await maybeSetAuthorizationTokenForRegistry(
      npmConfigUtils.normalizeRegistry(registry),
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
    await maybeSetAuthorizationTokenForRegistry(
      registry,
      registryConfigMap,
      tokenGenerator
    );
  }
};

/**
 * Map that stores mappings of registry -> authToken
 */
const authTokenMap: Map<string, string> = new Map();

/**
 * For a given registry, if it's an AWS CodeArtifact registry, generate an authorization token if we haven't already generated one for this registry, and set it in the configuration
 *
 * @param {string} registry
 * @param {RegistryConfigMap} registryConfigMap
 * @param {(AuthorizationTokenParams) => Promise<string>} tokenGenerator
 * @returns {Promise<void>}
 */
const maybeSetAuthorizationTokenForRegistry = async (
  registry: string,
  registryConfigMap: RegistryConfigMap,
  tokenGenerator: (AuthorizationTokenParams) => Promise<string>
): Promise<string | null> => {
  // skip this registry configuration if it already has a token set
  if (registryConfigMap.get("npmAuthToken")) return;

  // don't bother retrieving an auth token if we already have one for this registry
  if (!authTokenMap.has(registry)) {
    const authorizationTokenParams: AuthorizationTokenParams | null = parseRegistryUrl(
      registry
    );
    // not an AWS CodeArtifact registry
    if (authorizationTokenParams === null) return;

    const authorizationToken: string = await tokenGenerator(
      authorizationTokenParams
    );

    if (process.env._YARN_PLUGIN_AWS_CODEARTIFACT_DEBUG) {
      // TODO use a LightReport to write this to STDOUT, being careful to check for the `--json` flag from the user
      // tslint:disable-next-line:no-console
      console.log(
        `_YARN_PLUGIN_AWS_CODEARTIFACT_DEBUG: Setting token for registry ${registry} to ${authorizationToken}`
      );
    }

    // stash the token so we can re-use if we encounter this registry again
    authTokenMap.set(registry, authorizationToken);
  }

  setAuthConfiguration(registryConfigMap, authTokenMap.get(registry));
};

/**
 * Set an authorization token into a registry configuration
 *
 * @param registryConfigMap
 * @param authorizationToken
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
