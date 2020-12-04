import { execSync } from "child_process";
import { join } from "path";

describe("yarn plugin-aws-codeartifact version", () => {
  it("should output plugin version", () => {
    const cwd = join(__dirname, "fixtures", "test-package");
    const stdout = execSync("yarn plugin-aws-codeartifact version", {
      cwd,
    }).toString();
    const { version } = require("../../../package.json");
    expect(stdout).toBe(`${version}\n`);
  });
});
