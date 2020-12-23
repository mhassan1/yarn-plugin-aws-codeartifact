import { Command } from "clipanion";
import {
  Configuration,
  StreamReport,
  CommandContext,
  Locator,
  structUtils,
} from "@yarnpkg/core";
import { ppath, xfs } from "@yarnpkg/fslib";
import { parseSyml, stringifySyml } from "@yarnpkg/parsers";
import { npmConfigUtils } from "@yarnpkg/plugin-npm";
import { parseRegistryUrl } from "../utils";
import URL from "url";

/**
 * Command to migrate a `yarn.lock` file to use AWS CodeArtifact repositories for relevant packages
 */
export class MigrateCommand extends Command<CommandContext> {
  @Command.Path("plugin-aws-codeartifact", "migrate")
  async execute(): Promise<0 | 1> {
    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins
    );
    const streamReport = await StreamReport.start(
      {
        configuration,
        stdout: this.context.stdout,
      },
      async (report) => {
        await migrateLockFile(configuration, report);
      }
    );

    return streamReport.exitCode();
  }
}

type LockFileEntry = {
  resolution: string;
};

const NPM_PROTOCOL = "npm:";

/**
 * Modify the lockfile so that relevant packages resolve from AWS CodeArtifact
 *
 * @param {Configuration} configuration - Yarn configuration
 * @param {StreamReport} report - Yarn stream report
 * @returns {Promise<void>}
 */
const migrateLockFile = async (
  configuration: Configuration,
  report: StreamReport
) => {
  const lockfilePath = ppath.join(
    configuration.startingCwd,
    configuration.get("lockfileFilename")
  );
  const content = await xfs.readFilePromise(lockfilePath, "utf8");
  const parsed = parseSyml(content);

  const lockfileEntries: [string, LockFileEntry][] = Object.entries(
    parsed
  ).filter(([key]) => !key.startsWith("__"));
  let migratedCount = 0;

  for (const [key, { resolution }] of lockfileEntries) {
    const resolvedLockfileEntry = resolveLockfileEntry(
      configuration,
      resolution
    );
    if (resolvedLockfileEntry === null) continue;

    const { oldLocator, newLocator } = resolvedLockfileEntry;

    const oldLocatorString = structUtils.stringifyLocator(oldLocator);
    const newLocatorString = structUtils.stringifyLocator(newLocator);
    report.reportInfo(
      null,
      `Migrated ${oldLocatorString} => ${newLocatorString}`
    );

    parsed[key].resolution = newLocatorString;
    migratedCount++;
  }

  await xfs.changeFilePromise(lockfilePath, stringifySyml(parsed), {
    automaticNewlines: true,
  });

  report.reportInfo(
    null,
    `Migration complete! ${migratedCount} entries migrated. Now, run \`yarn\` to install everything.`
  );
};

/**
 * Resolve a resolution into its current and migrated locators
 *
 * @param {Configuration} configuration - Yarn configuration
 * @param {string} resolution - Yarn lockfile resolution
 * @returns {Locators} Old and new locators
 */
const resolveLockfileEntry = (
  configuration: Configuration,
  resolution: string
): { oldLocator: Locator; newLocator: Locator } | null => {
  const oldLocator = structUtils.parseLocator(resolution);

  const registry = npmConfigUtils.getScopeRegistry(oldLocator.scope, {
    configuration,
  });

  // if this entry is not related to an AWS CodeArtifact registry, skip it
  const parsedRegistry = parseRegistryUrl(registry);
  if (parsedRegistry === null) return null;

  const newLocator = computeMigratedLocator(resolution, registry);
  if (newLocator === null) return null;

  return { oldLocator, newLocator };
};

type Locators = {
  oldLocator: Locator;
  newLocator: Locator;
};

/**
 * Compute a migrated locator from a resolution and AWS CodeArtifact registry URL
 *
 * @param {string} resolution - Yarn lockfile resolution
 * @param {string} registry - AWS CodeArtifact Registry URL
 * @returns {Locator} Migrated locator
 */
export const computeMigratedLocator = (
  resolution: string,
  registry: string
): Locator | null => {
  const oldLocator = structUtils.parseLocator(resolution);

  // from `NpmSemverResolver.prototype.supportsLocator`
  if (!oldLocator.reference.startsWith(NPM_PROTOCOL)) return null;

  // from `structUtils.bindLocator`
  if (oldLocator.reference.includes(`::`)) return null;

  const version: string = oldLocator.reference.slice(NPM_PROTOCOL.length);

  // trailing slash has already been removed from `registry`
  const archiveUrlObj = URL.parse(
    `${registry}/${structUtils.stringifyIdent(oldLocator)}/-/${
      oldLocator.name
    }-${version}.tgz`
  );
  archiveUrlObj.host += ":443"; // AWS CodeArtifact tarball URLs include a port, even though it's default

  const archiveUrl = URL.format(archiveUrlObj);
  return structUtils.bindLocator(oldLocator, { __archiveUrl: archiveUrl });
};
