import objectPath from 'object-path'
import { Requester, Validator, AdapterError } from '@chainlink/external-adapter'
import { AdapterRequest, Config, Address, Account } from '@chainlink/types'
import { DEFAULT_DATA_PATH, getBaseURL } from '../config'
import { BLOCKCHAINS, isCoinType, isChainType } from '.'

export const Name = 'balance'

type RequestData = {
  dataPath: string
  confirmations: number
}

type ResponseWithResult = {
  response: any
  result: Account
  warning?: string
}

const WARNING_NO_OPERATION_COIN = 'No Operation: unsupported coin'
const WARNING_NO_OPERATION_TESTNET = "No Operation: 'testnet' is only supported on 'eth'"
const WARNING_NO_OPERATION_CHAIN =
  "No Operation: invalid chain parameter, must be one of 'mainnet' or 'testnet'"
const WARNING_NO_OPERATION_MISSING_ADDRESS = 'No Operation: address param is missing'

const getBalanceURI = (address: string) => `/api/v2/addresses/${address}/account-balances/latest`

const getBlockchainHeader = (chain: string, coin: string) => {
  const network = Requester.toVendorName(coin, BLOCKCHAINS)
  if (chain === 'testnet') {
    if (network === 'ethereum') return 'ethereum-rinkeby'
    throw WARNING_NO_OPERATION_TESTNET
  }
  return `${network}-mainnet`
}

const getBalances = async (config: Config, addresses: Address[]): Promise<ResponseWithResult[]> =>
  Promise.all(
    addresses.map(async (addr: Address) => {
      const warnedResponse = {
        result: { ...addr, balance: 0 },
        response: null,
      }

      if (!addr.address) return { ...warnedResponse, warning: WARNING_NO_OPERATION_MISSING_ADDRESS }

      if (!addr.coin) addr.coin = 'btc'
      if (isCoinType(addr.coin) === false)
        return {
          ...warnedResponse,
          warning: WARNING_NO_OPERATION_COIN,
        }

      if (!addr.chain) addr.chain = 'mainnet'
      if (isChainType(addr.chain) === false)
        return {
          ...warnedResponse,
          warning: WARNING_NO_OPERATION_CHAIN,
        }

      const reqConfig: any = {
        ...config.api,
        baseURL: getBaseURL(),
        url: getBalanceURI(addr.address),
      }

      reqConfig.headers['x-amberdata-blockchain-id'] = getBlockchainHeader(addr.chain, addr.coin)

      const response = await Requester.request(reqConfig)
      return {
        response: response.data,
        result: { ...addr, balance: response.data.payload.value },
      }
    }),
  )

const reduceResponse = (responses: ResponseWithResult[]) =>
  responses.reduce(
    (accumulator, current) => {
      accumulator.data.responses = [...accumulator.data.responses, current.response]
      accumulator.data.result = [...accumulator.data.result, current.result]
      return accumulator
    },
    {
      data: { responses: [], result: [] },
      status: 200,
    } as any,
  )

export const inputParams = {
  dataPath: false,
  confirmations: false,
}

// Export function to integrate with Chainlink node
export const execute = async (config: Config, request: AdapterRequest) => {
  const validator = new Validator(request, inputParams)
  if (validator.error) throw validator.error
  const jobRunID = validator.validated.id

  const data: RequestData = validator.validated.data
  const dataPath = data.dataPath || DEFAULT_DATA_PATH
  const inputData = <Address[]>objectPath.get(request.data, dataPath)

  // Check if input data is valid
  if (!inputData || !Array.isArray(inputData) || inputData.length === 0)
    throw new AdapterError({
      jobRunID,
      message: `Input, at '${dataPath}' path, must be a non-empty array.`,
      statusCode: 400,
    })
  const responses = await getBalances(config, inputData)
  return reduceResponse(responses)
}
