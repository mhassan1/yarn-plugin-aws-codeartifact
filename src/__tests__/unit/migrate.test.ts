import { computeMigratedLocator } from "../../commands/migrate";
import { structUtils } from "@yarnpkg/core";

describe("computeMigratedLocator", () => {
  const awsCodeArtifactRegistry =
    "https://domain-test-000000000000.d.codeartifact.us-east-1.amazonaws.com/npm/repo-test";
  it.each([
    [
      "@scope/name@npm:1.2.3",
      awsCodeArtifactRegistry,
      "@scope/name@npm:1.2.3::__archiveUrl=https%3A%2F%2Fdomain-test-000000000000.d.codeartifact.us-east-1.amazonaws.com%3A443%2Fnpm%2Frepo-test%2F%40scope%2Fname%2F-%2Fname-1.2.3.tgz",
    ],
    [
      "name@npm:1.2.3",
      awsCodeArtifactRegistry,
      "name@npm:1.2.3::__archiveUrl=https%3A%2F%2Fdomain-test-000000000000.d.codeartifact.us-east-1.amazonaws.com%3A443%2Fnpm%2Frepo-test%2Fname%2F-%2Fname-1.2.3.tgz",
    ],
    ["name@https://github.com/a/b.git", awsCodeArtifactRegistry, null],
    ["name@npm:1.2.3::a=b", awsCodeArtifactRegistry, null],
  ])(
    "should determine the registry type based on command-line arguments: %p",
    (resolution, registry, expected) => {
      const newLocator = computeMigratedLocator(resolution, registry);
      const newLocatorString =
        newLocator !== null ? structUtils.stringifyLocator(newLocator) : null;
      expect(newLocatorString).toBe(expected);
    }
  );
});
