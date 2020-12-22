import { folderUtils } from "@yarnpkg/core";
import { Filename, PortablePath, ppath, xfs } from "@yarnpkg/fslib";
import { parseSyml } from "@yarnpkg/parsers";
import { npmConfigUtils } from "@yarnpkg/plugin-npm";
import parser from "yargs-parser";
import { findRegistryCommand } from "./registryCommands";
import defaultsDeep from "lodash.defaultsdeep";
import get from "lodash.get";

/**
 * Name of the plugin configuration file
 */
const pluginConfigFilename = ".yarn-plugin-aws-codeartifact.yml" as Filename;

/**
 * Determine registry type for a `yarn` command
 * This is an imperfect way to check whether this command is a command that will need a registry, and which type of registry it is
 * TODO Once we have an appropriate hook, we should not need to do this
 *
 * @param {string[]} argv
 * @returns {string}
 */
export const getRegistryTypeForCommand = (
  argv: string[] = process.argv.slice(2)
): npmConfigUtils.RegistryType | null => {
  const yargsParserOutput = parser(argv);
  const { _: positionalArgs }: { _: string[] } = yargsParserOutput;

  // `yarn` by itself is the same as `yarn install`
  if (!positionalArgs.length) {
    positionalArgs.push("install");
  }

  let registryCommand = findRegistryCommand(positionalArgs);

  const { shiftPositionalArgs } = registryCommand || {};
  if (shiftPositionalArgs) {
    // shift `positionalArgs` and find the `registryCommand` again
    positionalArgs.splice(0, shiftPositionalArgs);
    registryCommand = findRegistryCommand(positionalArgs);
  }

  if (registryCommand === null) return null;

  const {
    registryFn = () => npmConfigUtils.RegistryType.FETCH_REGISTRY,
  } = registryCommand;
  return registryFn(yargsParserOutput);
};

/**
 * Check whether an array starts with a list of items
 *
 * @param {Array} arr
 * @param {Array} items
 * @returns {boolean}
 */
export const arrayStartsWith = (arr: any[], ...items): boolean => {
  for (let i = 0; i < items.length; i++) {
    if (arr[i] !== items[i]) return false;
  }
  return true;
};

/**
 * Parse an AWS CodeArtifact registry URL into its parts
 *
 * @param {string} registry
 * @returns {AuthorizationTokenParams}
 */
export const parseRegistryUrl = (
  registry: string
): AuthorizationTokenParams | null => {
  const match = registry.match(
    /^https?:\/\/(.+)-(\d+)\.d\.codeartifact\.(.+)\.amazonaws\.com\/npm\/(.+)\/?$/
  );

  if (!match) return null;

  const [, domain, domainOwner, region]: string[] = match;
  return { domain, domainOwner, region };
};

export type AuthorizationTokenParams = {
  domain: string;
  domainOwner: string;
  region: string;
};

/**
 * Build plugin configuration object
 *
 * @param {PortablePath} startingCwd
 * @returns {Promise<PluginConfig>}
 */
export const buildPluginConfig = async (
  startingCwd: PortablePath
): Promise<PluginConfig> => {
  const configFiles = await findPluginConfigFiles(startingCwd);
  const homeConfigFile = await findHomePluginConfigFile();
  if (homeConfigFile !== null) {
    configFiles.push(homeConfigFile);
  }
  const configData = configFiles.map(({ data }) => data);
  return defaultsDeep({}, ...configData);
};

export type PluginConfig = {
  npmRegistryServerConfig?: PluginRegistryConfig;
  npmPublishRegistryConfig?: PluginRegistryConfig;
  npmScopes?: {
    [scope: string]: {
      npmRegistryServerConfig?: PluginRegistryConfig;
      npmPublishRegistryConfig?: PluginRegistryConfig;
    };
  };
  npmRegistries?: {
    [registry: string]: PluginRegistryConfig;
  };
};

export type PluginRegistryConfig = {
  awsProfile: string;
};

/**
 * Traverse directories upwards looking for plugin configuration files (based on `Configuration.findRcFiles`)
 *
 * @param {PortablePath} startingCwd
 * @returns {Promise<{path: PortablePath, cwd: PortablePath, data: object}[]>}
 */
const findPluginConfigFiles = async (
  startingCwd: PortablePath
): Promise<{ path: PortablePath; cwd: PortablePath; data: any }[]> => {
  const configFiles = [];

  let nextCwd = startingCwd;
  let currentCwd = null;
  while (nextCwd !== currentCwd) {
    currentCwd = nextCwd;
    const configPath = ppath.join(
      currentCwd,
      pluginConfigFilename as PortablePath
    );
    if (xfs.existsSync(configPath)) {
      const content = await xfs.readFilePromise(configPath, `utf8`);
      const data = parseSyml(content) as any;
      configFiles.push({ path: configPath, cwd: currentCwd, data });
    }
    nextCwd = ppath.dirname(currentCwd);
  }

  return configFiles;
};

/**
 * Look for plugin configuration file in home directory (based on `Configuration.findHomeRcFile`)
 *
 * @returns {Promise<{path: PortablePath, cwd: PortablePath, data: object} | null>}
 */
const findHomePluginConfigFile = async () => {
  const homeFolder =
    process.env.NODE_ENV === "test"
      ? ppath.join(
          __dirname as PortablePath,
          ".." as PortablePath,
          ".." as PortablePath
        )
      : folderUtils.getHomeFolder();
  const homeConfigFilePath = ppath.join(homeFolder, pluginConfigFilename);

  if (xfs.existsSync(homeConfigFilePath)) {
    const content = await xfs.readFilePromise(homeConfigFilePath, `utf8`);
    const data = parseSyml(content) as any;
    return { path: homeConfigFilePath, cwd: homeFolder, data };
  }

  return null;
};

/**
 * Compute plugin registry configuration key for a registry type
 *
 * @param {npmConfigUtils.RegistryType} type
 * @returns {string}
 */
const computePluginRegistryConfigKey = (
  type: npmConfigUtils.RegistryType
): string => {
  return `${type}Config`;
};

/**
 * Get default plugin registry configuration (based on logic in `npmConfigUtils.getDefaultRegistry`)
 *
 * @param {PluginConfig} pluginConfig
 * @param {npmConfigUtils.RegistryType} type
 * @returns {PluginRegistryConfig | null}
 */
export const getDefaultPluginRegistryConfig = (
  pluginConfig: PluginConfig,
  type: npmConfigUtils.RegistryType
): PluginRegistryConfig | null => {
  return (
    get(pluginConfig, [computePluginRegistryConfigKey(type)]) ||
    get(pluginConfig, [
      computePluginRegistryConfigKey(
        npmConfigUtils.RegistryType.FETCH_REGISTRY
      ),
    ]) ||
    null
  );
};

/**
 * Get plugin registry configuration from `npmRegistries` (based on logic in `npmConfigUtils.getRegistryConfiguration`)
 *
 * @param {string} registry
 * @param {PluginConfig} pluginConfig
 * @returns {PluginRegistryConfig | null}
 */
export const getPluginRegistryConfig = (
  registry: string,
  pluginConfig: PluginConfig
): PluginRegistryConfig | null => {
  return get(pluginConfig, ["npmRegistries", registry]) || null;
};

/**
 * Get scope plugin registry configuration (based on logic in `npmConfigUtils.getScopeRegistry`)
 *
 * @param {string} scope
 * @param {PluginConfig} pluginConfig
 * @param {npmConfigUtils.RegistryType} type
 * @returns {PluginRegistryConfig | null}
 */
export const getScopePluginRegistryConfig = (
  scope: string,
  pluginConfig: PluginConfig,
  type: npmConfigUtils.RegistryType
): PluginRegistryConfig | null => {
  const scopeConfig = get(pluginConfig, ["npmScopes", scope]) || null;
  if (scopeConfig === null)
    return getDefaultPluginRegistryConfig(pluginConfig, type);
  return (
    get(scopeConfig, [computePluginRegistryConfigKey(type)]) ||
    getDefaultPluginRegistryConfig(pluginConfig, type)
  );
};
