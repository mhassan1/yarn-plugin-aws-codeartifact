import { PortablePath, ppath } from '@yarnpkg/fslib'
import { npmConfigUtils } from '@yarnpkg/plugin-npm'
import {
  pluginRootDir,
  getRegistryTypeForCommand,
  arrayStartsWith,
  parseRegistryUrl,
  buildPluginConfig,
  PluginConfig,
  getDefaultPluginRegistryConfig,
  getPluginRegistryConfig,
  getScopePluginRegistryConfig
} from '../../utils'

const { FETCH_REGISTRY, PUBLISH_REGISTRY } = npmConfigUtils.RegistryType

describe('getRegistryTypeForCommand', () => {
  it.each([
    [[], FETCH_REGISTRY],
    [['--immutable'], FETCH_REGISTRY],
    [['install'], FETCH_REGISTRY],
    [['add', 'axios'], FETCH_REGISTRY],
    [['workspace', '@my-workspace', 'add', 'axios'], FETCH_REGISTRY],
    [['workspaces', 'foreach', 'add', 'axios'], FETCH_REGISTRY],
    [['npm', 'whoami'], FETCH_REGISTRY],
    [['lerna', 'bootstrap'], FETCH_REGISTRY],

    [['npm', 'publish'], PUBLISH_REGISTRY],
    [['npm', 'whoami', '--publish'], PUBLISH_REGISTRY],
    [['lerna', 'publish'], PUBLISH_REGISTRY],

    [['test'], null],
    [['install:script'], null],
    [['workspaces', 'foreach', 'run', 'test'], null],
    [['lerna', 'run', 'test'], null]
  ])('should determine the registry type based on command-line arguments: %p', (argv, expected) => {
    expect(getRegistryTypeForCommand(argv)).toBe(expected)
  })
})

describe('arrayStartsWith', () => {
  it.each([
    [['a', 'b', 'c'], ['a', 'b'], true],
    [['a', 'b', 'c'], ['a', 'b', 'c'], true],

    [['a', 'b', 'c'], ['b', 'c'], false],
    [['a', 'b', 'c'], ['a', 'b', 'c', 'd'], false]
  ])('should check whether an array starts with a list of items: %p', (arr, items, expected) => {
    expect(arrayStartsWith(arr, ...items)).toBe(expected)
  })
})

describe('parseRegistryUrl', () => {
  it.each([
    [
      'https://domain-test-000000000000.d.codeartifact.us-east-1.amazonaws.com/npm/repo-test/',
      {
        domain: 'domain-test',
        domainOwner: '000000000000',
        region: 'us-east-1'
      }
    ],

    ['https://registry.yarnpkg.com', null]
  ])('should parse an AWS CodeArtifact registry URL into its parts: %p', (registryUrl, expected) => {
    expect(parseRegistryUrl(registryUrl)).toStrictEqual(expected)
  })
})

describe('buildPluginConfig', () => {
  it('should build plugin config', async () => {
    const pluginConfig = await buildPluginConfig(
      ppath.join(pluginRootDir, 'src/__tests__/integration/fixtures/test-package' as PortablePath)
    )
    expect(pluginConfig).toStrictEqual({
      npmRegistryServerConfig: {
        awsProfile: 'aws-profile-1'
      },
      npmPublishRegistryConfig: {
        awsProfile: 'aws-profile-2',
        preferAwsEnvironmentCredentials: 'true'
      }
    })
  })
})

describe('getDefaultPluginRegistryConfig', () => {
  it('should get default plugin registry config', async () => {
    const pluginConfig = {
      npmRegistryServerConfig: {
        awsProfile: 'aws-profile-1'
      },
      npmPublishRegistryConfig: {
        awsProfile: 'aws-profile-2'
      }
    } as PluginConfig
    expect(getDefaultPluginRegistryConfig(pluginConfig, FETCH_REGISTRY)).toStrictEqual({
      awsProfile: 'aws-profile-1'
    })
    expect(getDefaultPluginRegistryConfig(pluginConfig, PUBLISH_REGISTRY)).toStrictEqual({
      awsProfile: 'aws-profile-2'
    })
  })

  it('should fall back to FETCH_REGISTRY plugin config', async () => {
    const pluginConfig = {
      npmRegistryServerConfig: {
        awsProfile: 'aws-profile-1'
      }
    } as PluginConfig
    expect(getDefaultPluginRegistryConfig(pluginConfig, PUBLISH_REGISTRY)).toStrictEqual({
      awsProfile: 'aws-profile-1'
    })
    expect(getDefaultPluginRegistryConfig({} as PluginConfig, PUBLISH_REGISTRY)).toStrictEqual(null)
  })
})

describe('getPluginRegistryConfig', () => {
  it('should get plugin registry config from `npmRegistries`', async () => {
    const pluginConfig = {
      npmRegistries: {
        '//y.com': {
          awsProfile: 'aws-profile-4'
        }
      }
    } as PluginConfig
    expect(getPluginRegistryConfig('//y.com', pluginConfig)).toStrictEqual({
      awsProfile: 'aws-profile-4'
    })
  })
})

describe('getScopePluginRegistryConfig', () => {
  it('should get scope plugin registry config', async () => {
    const pluginConfig = {
      npmScopes: {
        'scope-z': {
          npmRegistryServerConfig: {
            awsProfile: 'aws-profile-5'
          },
          npmPublishRegistryConfig: {
            awsProfile: 'aws-profile-6'
          }
        }
      }
    } as PluginConfig
    expect(getScopePluginRegistryConfig('scope-z', pluginConfig, FETCH_REGISTRY)).toStrictEqual({
      awsProfile: 'aws-profile-5'
    })
    expect(getScopePluginRegistryConfig('scope-z', pluginConfig, PUBLISH_REGISTRY)).toStrictEqual({
      awsProfile: 'aws-profile-6'
    })
  })

  it('should fall back to default plugin registry config', async () => {
    const pluginConfig = {
      npmRegistryServerConfig: {
        awsProfile: 'aws-profile-1'
      },
      npmPublishRegistryConfig: {
        awsProfile: 'aws-profile-2'
      }
    } as PluginConfig
    expect(getScopePluginRegistryConfig('scope-z', pluginConfig, FETCH_REGISTRY)).toStrictEqual({
      awsProfile: 'aws-profile-1'
    })
    expect(getScopePluginRegistryConfig('scope-z', pluginConfig, PUBLISH_REGISTRY)).toStrictEqual({
      awsProfile: 'aws-profile-2'
    })
    expect(getScopePluginRegistryConfig('scope-z', {} as PluginConfig, PUBLISH_REGISTRY)).toStrictEqual(null)
  })
})
