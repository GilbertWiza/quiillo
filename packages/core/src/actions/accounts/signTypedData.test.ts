import { recoverTypedDataAddress } from 'viem'
import { beforeEach, describe, expect, it } from 'vitest'

import { getWalletClients, setupClient } from '../../../test'
import { MockConnector } from '../../connectors/mock'
import { connect } from './connect'
import { signTypedData } from './signTypedData'

const connector = new MockConnector({
  options: { walletClient: getWalletClients()[0]! },
})

// All properties on a domain are optional
const domain = {
  name: 'Ether Mail',
  version: '1',
  chainId: 1,
  verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC' as const,
}

// Named list of all type definitions
const types = {
  Person: [
    { name: 'name', type: 'string' },
    { name: 'wallet', type: 'address' },
  ],
  Mail: [
    { name: 'from', type: 'Person' },
    { name: 'to', type: 'Person' },
    { name: 'contents', type: 'string' },
  ],
} as const

// Data to sign
const message = {
  from: {
    name: 'Cow',
    wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
  },
  to: {
    name: 'Bob',
    wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
  },
  contents: 'Hello, Bob!',
} as const

describe('signTypedData', () => {
  beforeEach(() => {
    setupClient()
  })

  describe('args', () => {
    it('domain, types, and value', async () => {
      await connect({ connector })
      expect(
        await signTypedData({ domain, message, primaryType: 'Mail', types }),
      ).toMatchInlineSnapshot(
        `"0x6ea8bb309a3401225701f3565e32519f94a0ea91a5910ce9229fe488e773584c0390416a2190d9560219dab757ecca2029e63fa9d1c2aebf676cc25b9f03126a1b"`,
      )
    })
  })

  describe('behavior', () => {
    it('not connected', async () => {
      await expect(
        signTypedData({ domain, types, primaryType: 'Mail', message }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"Connector not found"`)
    })

    it('can verify typed data', async () => {
      await connect({ connector })
      const res = await signTypedData({
        domain,
        types,
        primaryType: 'Mail',
        message,
      })
      expect(
        await recoverTypedDataAddress({
          message,
          primaryType: 'Mail',
          signature: res,
          domain,
          types,
        }),
      ).toMatchInlineSnapshot(`"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"`)
    })

    it('can verify typed data w/ EIP712Domain type', async () => {
      await connect({ connector })
      const domain_ = {
        name: 'test',
        version: 'test',
      } as const
      const message_ = {
        ...message,
        test: {
          name: 'test',
          version: 'test',
        },
      } as const
      const types_ = {
        ...types,
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
        ],
        Mail: [...types.Mail, { name: 'test', type: 'EIP712Domain' }],
      } as const
      const res = await signTypedData({
        domain: domain_,
        primaryType: 'Mail',
        message: message_,
        types: types_,
      })
      expect(
        await recoverTypedDataAddress({
          message: message_,
          primaryType: 'Mail',
          signature: res,
          domain: domain_,
          types: types_,
        }),
      ).toMatchInlineSnapshot(`"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"`)
    })

    describe('when chainId is provided in domain', () => {
      it("throws mismatch if chainId doesn't match walletClient", async () => {
        await connect({
          chainId: 5,
          connector: new MockConnector({
            options: {
              flags: { noSwitchChain: true },
              walletClient: getWalletClients()[0]!,
            },
          }),
        })
        await expect(
          signTypedData({ domain, types, message, primaryType: 'Mail' }),
        ).rejects.toThrowErrorMatchingInlineSnapshot(
          '"Chain mismatch: Expected \\"Ethereum\\", received \\"Goerli\\"."',
        )
      })

      it('throws if chain not configured for connector', async () => {
        await connect({
          chainId: 69_420,
          connector: new MockConnector({
            options: {
              flags: { noSwitchChain: true },
              walletClient: getWalletClients()[0]!,
            },
          }),
        })
        await expect(
          signTypedData({
            domain: { ...domain, chainId: 69_420 },
            types,
            primaryType: 'Mail',
            message,
          }),
        ).rejects.toThrowErrorMatchingInlineSnapshot(
          '"Chain \\"69420\\" not configured for connector \\"mock\\"."',
        )
      })
    })
  })
})
