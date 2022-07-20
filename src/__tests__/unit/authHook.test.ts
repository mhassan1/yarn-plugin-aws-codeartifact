import { npmConfigUtils } from '@yarnpkg/plugin-npm'
import { computeAuthToken, getPluginConfigStartingCwd } from '../../authHook'
import { Configuration } from '@yarnpkg/core'
import { npath, PortablePath } from '@yarnpkg/fslib'
import { AuthorizationTokenParams, PluginRegistryConfig, computePluginRegistryConfigKey } from '../../utils'

const { FETCH_REGISTRY } = npmConfigUtils.RegistryType

const awsCodeArtifactRegistryFactory = (i: number) =>
  `https://domain-test-00000000000${i}.d.codeartifact.us-east-1.amazonaws.com/npm/repo-test/`

let tokenGeneratorCallCount: number
const tokenGenerator = async (
  authorizationTokenParams: AuthorizationTokenParams,
  pluginRegistryConfig: PluginRegistryConfig | null
) => {
  const { domainOwner } = authorizationTokenParams
  const { awsProfile = null } = pluginRegistryConfig || {}
  tokenGeneratorCallCount++
  const i = Number(domainOwner.slice(-1)[0])
  if (i === 4) throw new Error('awsCodeArtifactRegistry4 should never be called')
  return `test-token-${i}-${awsProfile}`
}

describe('computeAuthToken', () => {
  it('should compute an auth token', async () => {
    tokenGeneratorCallCount = 0

    const awsCodeArtifactRegistry1 = awsCodeArtifactRegistryFactory(1)
    const awsCodeArtifactRegistry2 = awsCodeArtifactRegistryFactory(2)
    const awsCodeArtifactRegistry3 = awsCodeArtifactRegistryFactory(3)

    const pluginConfig = {
      npmRegistries: {
        // with trailing slash (this is not allowed)
        [awsCodeArtifactRegistry1]: {
          awsProfile: 'aws-profile-1'
        },
        // without trailing slash
        [awsCodeArtifactRegistry2.slice(0, -1)]: {
          awsProfile: 'aws-profile-2'
        },
        // without protocol and trailing slash
        [awsCodeArtifactRegistry3.slice(6, -1)]: {
          awsProfile: 'aws-profile-3'
        },
        // not an AWS CodeArtifact registry
        '//x.com': {
          awsProfile: 'none'
        }
      },
      npmScopes: {
        'scope-a': {
          [computePluginRegistryConfigKey(FETCH_REGISTRY)]: {
            awsProfile: 'aws-profile-scope-a'
          }
        }
      }
    }

    expect(tokenGeneratorCallCount).toBe(0)

    // The given profile wasn't used because the regsitry was in correct
    expect(await computeAuthToken(awsCodeArtifactRegistry1, null, FETCH_REGISTRY, pluginConfig, tokenGenerator)).toBe(
      'test-token-1-null'
    )
    expect(tokenGeneratorCallCount).toBe(1)

    expect(await computeAuthToken(awsCodeArtifactRegistry2, null, FETCH_REGISTRY, pluginConfig, tokenGenerator)).toBe(
      'test-token-2-aws-profile-2'
    )

    expect(tokenGeneratorCallCount).toBe(2)

    expect(await computeAuthToken(awsCodeArtifactRegistry3, null, FETCH_REGISTRY, pluginConfig, tokenGenerator)).toBe(
      'test-token-3-aws-profile-3'
    )

    expect(tokenGeneratorCallCount).toBe(3)

    expect(
      await computeAuthToken(awsCodeArtifactRegistry1, 'scope-a', FETCH_REGISTRY, pluginConfig, tokenGenerator)
    ).toBe('test-token-1-aws-profile-scope-a')

    expect(tokenGeneratorCallCount).toBe(4)

    expect(
      await computeAuthToken(awsCodeArtifactRegistry1, 'scope-a', FETCH_REGISTRY, pluginConfig, tokenGenerator)
    ).toBe('test-token-1-aws-profile-scope-a')

    expect(tokenGeneratorCallCount).toBe(4)

    // Should just use the default configuration
    expect(
      await computeAuthToken(awsCodeArtifactRegistry1, 'scope-b', FETCH_REGISTRY, pluginConfig, tokenGenerator)
    ).toBe('test-token-1-null')

    expect(tokenGeneratorCallCount).toBe(5)
  })
})

describe('getPluginConfigStartingCwd', () => {
  it('should determine the starting directory for plugin configuration files', () => {
    const configuration = {
      startingCwd: '/a/b/c' as PortablePath
    } as Configuration
    expect(getPluginConfigStartingCwd(configuration)).toBe(configuration.startingCwd)
  })

  it('should determine the starting directory for plugin configuration files when using `dlx`', () => {
    const configuration = {
      projectCwd: `/x/dlx-${process.pid}` as PortablePath
    } as Configuration
    expect(getPluginConfigStartingCwd(configuration)).toBe(npath.toPortablePath(process.cwd()))
  })
})
