import { Plugin } from '@yarnpkg/core'
import { getNpmAuthenticationHeader } from './authHook'

const plugin: Plugin = {
  hooks: {
    getNpmAuthenticationHeader
  }
}
export default plugin
