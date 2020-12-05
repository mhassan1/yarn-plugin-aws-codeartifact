import {
  Configuration,
  StreamReport,
  Locator,
  structUtils,
} from "@yarnpkg/core";
import { ppath, xfs } from "@yarnpkg/fslib";
import { parseSyml, stringifySyml } from "@yarnpkg/parsers";
import { npmConfigUtils } from "@yarnpkg/plugin-npm";
import { parseRegistryUrl } from "./utils";
import URL from "url";

type LockFileEntry = {
  resolution: string;
};

const NPM_PROTOCOL = "npm:";

/**
 * Modify the lockfile so that all packages resolve from AWS CodeArtifact
 *
 * @param {Configuration} configuration
 * @param {StreamReport} report
 */
export const migrateLockFile = async ({
  configuration,
  report,
}: {
  configuration: Configuration;
  report: StreamReport;
}) => {
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
 * @param {Configuration} configuration
 * @param {string} resolution
 * @returns {{Locator} oldLocator, {Locator} newLocator}
 */
export const resolveLockfileEntry = (
  configuration: Configuration,
  resolution: string
): { oldLocator: Locator; newLocator: Locator } | null => {
  const oldLocator = structUtils.parseLocator(resolution);

  const registry = npmConfigUtils.getDefaultRegistry({ configuration });

  // if this entry is not related to an AWS CodeArtifact registry, skip it
  const parsedRegistry = parseRegistryUrl(registry);
  if (parsedRegistry === null) return null;

  const newLocator = computeMigratedLocator(resolution, registry);
  if (newLocator === null) return null;

  return { oldLocator, newLocator };
};

/**
 * Compute a migrated locator from a resolution and registry
 *
 * @param {string} resolution
 * @param {string} registry
 * @returns {Locator}
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
