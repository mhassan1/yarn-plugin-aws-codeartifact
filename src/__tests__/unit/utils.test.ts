import { npmConfigUtils } from "@yarnpkg/plugin-npm";
import {
  getRegistryTypeForCommand,
  arrayStartsWith,
  parseRegistryUrl,
} from "../../utils";

const { FETCH_REGISTRY, PUBLISH_REGISTRY } = npmConfigUtils.RegistryType;

describe("getRegistryTypeForCommand", () => {
  it.each([
    [[], FETCH_REGISTRY],
    [["--immutable"], FETCH_REGISTRY],
    [["install"], FETCH_REGISTRY],
    [["add", "axios"], FETCH_REGISTRY],
    [["workspace", "@my-workspace", "add", "axios"], FETCH_REGISTRY],
    [["workspaces", "foreach", "add", "axios"], FETCH_REGISTRY],
    [["npm", "whoami"], FETCH_REGISTRY],
    [["lerna", "bootstrap"], FETCH_REGISTRY],

    [["npm", "publish"], PUBLISH_REGISTRY],
    [["npm", "whoami", "--publish"], PUBLISH_REGISTRY],
    [["lerna", "publish"], PUBLISH_REGISTRY],

    [["test"], null],
    [["install:script"], null],
    [["workspaces", "foreach", "run", "test"], null],
    [["lerna", "run", "test"], null],
  ])(
    "should determine the registry type based on command-line arguments: %p",
    (argv, expected) => {
      expect(getRegistryTypeForCommand(argv)).toBe(expected);
    }
  );
});

describe("arrayStartsWith", () => {
  it.each([
    [["a", "b", "c"], ["a", "b"], true],
    [["a", "b", "c"], ["a", "b", "c"], true],

    [["a", "b", "c"], ["b", "c"], false],
    [["a", "b", "c"], ["a", "b", "c", "d"], false],
  ])(
    "should check whether an array starts with a list of items: %p",
    (arr, items, expected) => {
      expect(arrayStartsWith(arr, ...items)).toBe(expected);
    }
  );
});

describe("parseRegistryUrl", () => {
  it.each([
    [
      "https://domain-test-000000000000.d.codeartifact.us-east-1.amazonaws.com/npm/repo-test/",
      {
        domain: "domain-test",
        domainOwner: "000000000000",
        region: "us-east-1",
      },
    ],

    ["https://registry.yarnpkg.com", null],
  ])(
    "should parse an AWS CodeArtifact registry URL into its parts: %p",
    (registryUrl, expected) => {
      expect(parseRegistryUrl(registryUrl)).toStrictEqual(expected);
    }
  );
});
