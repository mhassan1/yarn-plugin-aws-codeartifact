import { Plugin, Configuration, CommandContext } from "@yarnpkg/core";
import { npmConfigUtils } from "@yarnpkg/plugin-npm";
import {
  getRegistryTypeForCommand,
  parseRegistryUrl,
  AuthorizationTokenParams,
} from "./utils";
import { Codeartifact } from "@aws-sdk/client-codeartifact";
import { Command } from "clipanion";
import { version } from "../package.json";

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
 * Set auth token if it's not already set, we recognize the `yarn` command as one requiring a registry,
 * and we recognize the registry as an AWS CodeArtifact registry
 *
 * @param {Configuration} configuration
 * @returns {Promise<void>}
 */
const maybeSetAuthToken = async ({
  configuration,
}: {
  configuration: Configuration;
}) => {
  // skip setting if it's already set
  if (configuration.values.get("npmAuthToken")) {
    return;
  }

  const registryType: npmConfigUtils.RegistryType | null = getRegistryTypeForCommand();
  // not a command that requires a registry
  if (registryType === null) return;

  const registry: string = npmConfigUtils.getDefaultRegistry({
    configuration,
    type: registryType,
  });

  const authorizationTokenParams: AuthorizationTokenParams | null = parseRegistryUrl(
    registry
  );
  // not an AWS CodeArtifact registry
  if (authorizationTokenParams === null) return;

  const authorizationToken: string = await getAuthorizationToken(
    authorizationTokenParams
  );

  // set these values in memory, to be used by Yarn
  configuration.values.set("npmAlwaysAuth", true);
  configuration.values.set("npmAuthToken", authorizationToken);

  if (process.env._YARN_PLUGIN_AWS_CODEARTIFACT_DEBUG) {
    // tslint:disable-next-line:no-console
    console.log(
      `_YARN_PLUGIN_AWS_CODEARTIFACT_DEBUG: Setting token for registry ${registry} to ${authorizationToken}`
    );
  }
};

/**
 * Retrieve an authorization token from AWS CodeArtifact
 *
 * @param {string} domain
 * @param {string} domainOwner
 * @param {string} region
 */
const getAuthorizationToken = async ({
  domain,
  domainOwner,
  region,
}: AuthorizationTokenParams): Promise<string> => {
  // for testing purposes only
  if (process.env._YARN_PLUGIN_AWS_CODEARTIFACT_TESTING) {
    const mockToken = [domain, domainOwner, region].join("~");
    // tslint:disable-next-line:no-console
    console.log(`TESTING~~~${mockToken}~~~TESTING`);
    return mockToken;
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
 * Command to provide info about this plugin
 */
class InfoCommand extends Command<CommandContext> {
  @Command.Path("plugin", "info", "aws-codeartifact")
  async execute() {
    this.context.stdout.write(`Version: ${version}\n`);
  }
}

const plugin: Plugin = {
  commands: [InfoCommand],
};
export default plugin;
