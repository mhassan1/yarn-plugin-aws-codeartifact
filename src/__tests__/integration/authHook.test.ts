import { execSync } from "child_process";
import { join } from "path";

const env = {
  ...process.env,
  _YARN_PLUGIN_AWS_CODEARTIFACT_TESTING: "true",
  _YARN_PLUGIN_AWS_CODEARTIFACT_DEBUG: "true",
};
const expectedRegex = /Setting token for registry .+ to ~~~domain-test~000000000000~us-east-1~aws-profile-2~~~/;

describe("commands that require a registry", () => {
  it("should retrieve authorization tokens for AWS CodeArtifact registries", () => {
    const cwd = join(__dirname, "fixtures", "test-package");
    // `yarn npm audit` requires a `PUBLISH_REGISTRY`, which is an AWS CodeArtifact registry
    // this command will fail because AWS CodeArtifact doesn't support `npm audit`, but it's okay to ignore for this test
    const stdout = execSync("yarn npm audit || exit 0", {
      cwd,
      env,
    }).toString();
    expect(stdout).toMatch(expectedRegex);
  });

  it("should not retrieve authorization tokens for non-AWS CodeArtifact registries", () => {
    const cwd = join(__dirname, "fixtures", "test-package");
    // `yarn` requires a `FETCH_REGISTRY`, which is not an AWS CodeArtifact registry
    const stdout = execSync("yarn", {
      cwd,
      env,
    }).toString();
    expect(stdout).not.toMatch(expectedRegex);
  });
});

describe("commands that don't require a registry", () => {
  it("should not retrieve authorization tokens", () => {
    const cwd = join(__dirname, "fixtures", "test-package");
    const stdout = execSync("yarn echo", {
      cwd,
      env,
    }).toString();
    expect(stdout).not.toMatch(expectedRegex);
  });
});
