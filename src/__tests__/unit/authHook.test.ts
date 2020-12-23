import { npmConfigUtils } from "@yarnpkg/plugin-npm";
import { maybeSetAuthorizationTokensForRegistries } from "../../authHook";
import { Configuration } from "@yarnpkg/core";
import { AuthorizationTokenParams, PluginRegistryConfig } from "../../utils";

const { FETCH_REGISTRY, PUBLISH_REGISTRY } = npmConfigUtils.RegistryType;
const NPM_AUTH_TOKEN = "npmAuthToken";
const NPM_ALWAYS_AUTH = "npmAlwaysAuth";

const awsCodeArtifactRegistryFactory = (i: number) =>
  `https://domain-test-00000000000${i}.d.codeartifact.us-east-1.amazonaws.com/npm/repo-test/`;

let tokenGeneratorCallCount: number;
const tokenGenerator = async (
  authorizationTokenParams: AuthorizationTokenParams,
  pluginRegistryConfig: PluginRegistryConfig | null
) => {
  const { domainOwner } = authorizationTokenParams;
  const { awsProfile = null } = pluginRegistryConfig || {};
  tokenGeneratorCallCount++;
  const i = Number(domainOwner.slice(-1)[0]);
  if (i === 4)
    throw new Error("awsCodeArtifactRegistry4 should never be called");
  return `test-token-${i}-${awsProfile}`;
};

describe("maybeSetAuthorizationTokensForRegistries", () => {
  it.each([
    // 3 times:
    // - `npmRegistryServer -> awsCodeArtifactRegistry1`
    // - `npmRegistries -> awsCodeArtifactRegistry2`
    // - `npmScopes (scope-a, aws-profile-7) -> awsCodeArtifactRegistry3`
    [FETCH_REGISTRY, 3],
    // 1 time:
    // - `npmScopes (scope-a, no profile) -> awsCodeArtifactRegistry3`
    [PUBLISH_REGISTRY, 1],
  ])(
    "should set the full registry configuration : %p",
    async (registryType, expectedTokenGeneratorCallCount) => {
      tokenGeneratorCallCount = 0;
      const configuration = {
        startingCwd: __dirname,
        get(key: string) {
          if (!this.values.has(key))
            throw new Error(`Invalid configuration key "${key}"`);
          return this.values.get(key);
        },
        values: new Map(),
      } as Configuration;

      const awsCodeArtifactRegistry1 = awsCodeArtifactRegistryFactory(1);
      const awsCodeArtifactRegistry2 = awsCodeArtifactRegistryFactory(2);
      const awsCodeArtifactRegistry3 = awsCodeArtifactRegistryFactory(3);
      const awsCodeArtifactRegistry4 = awsCodeArtifactRegistryFactory(4);
      configuration.values.set(registryType, awsCodeArtifactRegistry1);
      configuration.values.set(
        "npmRegistries",
        new Map([
          [awsCodeArtifactRegistry2, new Map()], // with protocol
          [awsCodeArtifactRegistry2.slice(6), new Map()], // without protocol
          [awsCodeArtifactRegistry2.slice(0, -1), new Map()], // without trailing slash
          ["//x.com", new Map()], // not an AWS CodeArtifact registry
          [
            awsCodeArtifactRegistry4,
            new Map([
              // already has a token
              [NPM_AUTH_TOKEN, "already-here"],
            ]),
          ],
        ])
      );
      configuration.values.set(
        "npmScopes",
        new Map([
          ["scope-a", new Map([[registryType, awsCodeArtifactRegistry3]])],
          ["scope-b", new Map([[registryType, "https://x.com"]])],
          [
            "scope-c",
            new Map([
              [registryType, awsCodeArtifactRegistry4],
              [NPM_AUTH_TOKEN, "already-here"],
            ]),
          ],
        ])
      );

      await maybeSetAuthorizationTokensForRegistries(
        configuration,
        registryType,
        tokenGenerator
      );

      expect(configuration.values.get(NPM_AUTH_TOKEN)).toBe(
        "test-token-1-null"
      );
      expect(configuration.values.get(NPM_ALWAYS_AUTH)).toBe(true);

      expect(
        configuration.values
          .get("npmRegistries")
          .get(awsCodeArtifactRegistry2)
          .get(NPM_AUTH_TOKEN)
      ).toBe("test-token-2-null");
      expect(
        configuration.values
          .get("npmRegistries")
          .get(awsCodeArtifactRegistry2)
          .get(NPM_ALWAYS_AUTH)
      ).toBe(true);
      expect(
        configuration.values
          .get("npmRegistries")
          .get(awsCodeArtifactRegistry2.slice(6))
          .get(NPM_AUTH_TOKEN)
      ).toBe("test-token-2-null");
      expect(
        configuration.values
          .get("npmRegistries")
          .get(awsCodeArtifactRegistry2.slice(6))
          .get(NPM_ALWAYS_AUTH)
      ).toBe(true);
      expect(
        configuration.values
          .get("npmRegistries")
          .get(awsCodeArtifactRegistry2.slice(0, -1))
          .get(NPM_AUTH_TOKEN)
      ).toBe("test-token-2-null");
      expect(
        configuration.values
          .get("npmRegistries")
          .get(awsCodeArtifactRegistry2.slice(0, -1))
          .get(NPM_ALWAYS_AUTH)
      ).toBe(true);
      expect(
        configuration.values
          .get("npmRegistries")
          .get("//x.com")
          .get(NPM_AUTH_TOKEN)
      ).toBe(undefined);
      expect(
        configuration.values
          .get("npmRegistries")
          .get("//x.com")
          .get(NPM_ALWAYS_AUTH)
      ).toBe(undefined);
      expect(
        configuration.values
          .get("npmRegistries")
          .get(awsCodeArtifactRegistry4)
          .get(NPM_AUTH_TOKEN)
      ).toBe("already-here");
      expect(
        configuration.values
          .get("npmRegistries")
          .get(awsCodeArtifactRegistry4)
          .get(NPM_ALWAYS_AUTH)
      ).toBe(undefined);

      expect(
        configuration.values.get("npmScopes").get("scope-a").get(NPM_AUTH_TOKEN)
      ).toBe(
        `test-token-3-${
          registryType === FETCH_REGISTRY ? "aws-profile-7" : null
        }`
      );
      expect(
        configuration.values
          .get("npmScopes")
          .get("scope-a")
          .get(NPM_ALWAYS_AUTH)
      ).toBe(true);
      expect(
        configuration.values.get("npmScopes").get("scope-b").get(NPM_AUTH_TOKEN)
      ).toBe(undefined);
      expect(
        configuration.values
          .get("npmScopes")
          .get("scope-b")
          .get(NPM_ALWAYS_AUTH)
      ).toBe(undefined);
      expect(
        configuration.values.get("npmScopes").get("scope-c").get(NPM_AUTH_TOKEN)
      ).toBe("already-here");
      expect(
        configuration.values
          .get("npmScopes")
          .get("scope-c")
          .get(NPM_ALWAYS_AUTH)
      ).toBe(undefined);

      expect(tokenGeneratorCallCount).toBe(expectedTokenGeneratorCallCount);
    }
  );
});
