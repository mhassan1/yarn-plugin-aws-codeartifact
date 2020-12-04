import { npmConfigUtils } from "@yarnpkg/plugin-npm";
import parser from "yargs-parser";
import { findRegistryCommand } from "./registryCommands";

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
