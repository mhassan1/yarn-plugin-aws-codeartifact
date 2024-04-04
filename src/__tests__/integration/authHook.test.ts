import { execSync } from 'child_process'
import { join } from 'path'

import { SKIP_PLUGIN_ERROR } from '../../authHook'

const env = {
  ...process.env,
  _YARN_PLUGIN_AWS_CODEARTIFACT_DEBUG: 'true'
}
const expectedRegex = (awsProfile: string) =>
  new RegExp(
    `Retrieved token for authorization parameters .+ ~~~domain-test~000000000000~us-east-1~${awsProfile}~true~~~`
  )

describe('commands that require a registry', () => {
  describe('should retrieve authorization tokens for', () => {
    it('AWS CodeArtifact registries', () => {
      const cwd = join(__dirname, 'fixtures', 'test-package')
      // `yarn npm audit` requires a `PUBLISH_REGISTRY`, which is an AWS CodeArtifact registry
      // this command will fail because this is not a real AWS CodeArtifact repository, but it's okay to ignore for this test
      const stdout = execSync('yarn npm tag add my-pkg@2.3.4-beta.4 beta || exit 0', {
        cwd,
        env
      }).toString()
      expect(stdout).toMatch(expectedRegex('aws-profile-2'))
      expect(stdout).toContain(`pwd --> ${join(__dirname, 'fixtures')}\n`)
    })

    it('AWS CodeArtifact registries when using "dlx"', () => {
      const cwd = join(__dirname, 'fixtures', 'test-package')
      // this command requires a `FETCH_REGISTRY` for scope `my-scope`, which is an AWS CodeArtifact registry
      // this command will fail because this is not a real AWS CodeArtifact repository, but it's okay to ignore for this test
      const stdout = execSync('yarn dlx @my-scope/my-package || exit 0', {
        cwd,
        env
      }).toString()

      expect(stdout).toMatch(expectedRegex('aws-profile-my-scope-1'))
    })

    it('should return "Bearer {process.env.CODEARTIFACT_AUTH_TOKEN}}" when _YARN_PLUGIN_AWS_CODEARTIFACT_DISABLE is set', () => {
      const cwd = join(__dirname, 'fixtures', 'test-package')
      const mockCodeArtifactAuthToken = 'FAKE_CODEARTIFACT_AUTH_TOKEN'
      const modifiedEnv = {
        ...env,
        _YARN_PLUGIN_AWS_CODEARTIFACT_DISABLE: '*',
        CODEARTIFACT_AUTH_TOKEN: mockCodeArtifactAuthToken
      }
      const stdout = execSync('yarn npm tag add my-pkg@2.3.4-beta.4 beta || exit 0', {
        cwd,
        env: modifiedEnv
      }).toString()
      // it will fail, but we want to make sure the mock token is used in that failure
      expect(stdout).toContain(mockCodeArtifactAuthToken)
    })

    it('should error when _YARN_PLUGIN_AWS_CODEARTIFACT_DISABLE is set with no existing CODEARTIFACT_AUTH_TOKEN', () => {
      const cwd = join(__dirname, 'fixtures', 'test-package')
      const modifiedEnv = {
        ...env,
        _YARN_PLUGIN_AWS_CODEARTIFACT_DISABLE: '*'
      }
      const stdout = execSync('yarn npm tag add my-pkg@2.3.4-beta.4 beta || exit 0', {
        cwd,
        env: modifiedEnv
      }).toString()
      // does it fail with the correct message?
      expect(stdout).toContain(SKIP_PLUGIN_ERROR)
    })
  })

  describe('should not retrieve authorization tokens for', () => {
    it('non-AWS CodeArtifact registries', () => {
      const cwd = join(__dirname, 'fixtures', 'test-package')
      // `yarn` requires a `FETCH_REGISTRY`, which is not an AWS CodeArtifact registry
      const stdout = execSync('yarn', {
        cwd,
        env
      }).toString()
      expect(stdout).not.toMatch(expectedRegex('aws-profile-2'))
    })
  })
})

describe("commands that don't require a registry", () => {
  it('should not retrieve authorization tokens', () => {
    const cwd = join(__dirname, 'fixtures', 'test-package')
    const stdout = execSync('yarn echo', {
      cwd,
      env
    }).toString()
    expect(stdout).not.toMatch(/Retrieved token for authorization parameters/)
  })
})
