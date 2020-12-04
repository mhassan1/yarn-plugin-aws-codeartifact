import { execSync } from "child_process";
import { join } from "path";

describe("yarn plugin info aws-codeartifact", () => {
  it("should output plugin version", () => {
    const cwd = join(__dirname, "fixtures", "test-package");
    const stdout = execSync("yarn plugin info aws-codeartifact", {
      cwd,
    }).toString();
    const { version } = require("../../../package.json");
    expect(stdout).toBe(`Version: ${version}\n`);
  });
});
