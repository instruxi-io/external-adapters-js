import Decimal from 'decimal.js'
import { WebSocketTransport } from '@chainlink/external-adapter-framework/transports/websocket'
import { makeLogger, ProviderResult } from '@chainlink/external-adapter-framework/util'
import { BaseEndpointTypes, GeneratePriceOptions } from '../endpoint/price'
import { calculateCacheKey } from '@chainlink/external-adapter-framework/cache'

const logger = makeLogger('TpIcapPrice')

type WsMessage = {
  msg: 'auth' | 'sub'
  pro?: string
  rec: string // example: FXSPTEURUSDSPT:GBL.BIL.QTE.RTM!IC
  sta: number
  img?: number
  fvs?: {
    CCY1?: string // example: "EUR"
    CCY2?: string // example: "USD"
    ACTIV_DATE?: string // example: "2023-03-06"
    TIMACT?: string // example: "15:00:00"
    BID?: number
    ASK?: number
    MID_PRICE?: number
  }
}

export type WsTransportTypes = BaseEndpointTypes & {
  Provider: {
    WsMessage: WsMessage
  }
}

const isNum = (i: number | undefined) => typeof i === 'number'

let providerDataStreamEstablishedUnixMs: number

/*
TP and ICAP EAs currently do not receive asset prices during off-market hours. When a heartbeat message is received during these hours,
we update the TTL of cache entries that EA is requested to provide a price during off-market hours.
 */
const updateTTL = async (transport: WebSocketTransport<WsTransportTypes>) => {
  // Get current active entries in the subscription set
  const sSet = await transport.subscriptionSet.getAll()
  // For each entry in sSet, calculate the cache key and try to update the ttl of an entry
  sSet.forEach((param) => {
    const key = calculateCacheKey({
      transportName: transport.name,
      data: param,
      adapterName: transport.responseCache.adapterName,
      endpointName: transport.responseCache.endpointName,
      adapterSettings: transport.responseCache.adapterSettings,
    })
    transport.responseCache.cache.setTTL(key, transport.responseCache.adapterSettings.CACHE_MAX_AGE)
  })
}

export const generateTransport = (generatePriceOptions: GeneratePriceOptions) => {
  const tpTransport = new WebSocketTransport<WsTransportTypes>({
    url: ({ adapterSettings: { WS_API_ENDPOINT } }) => WS_API_ENDPOINT,
    handlers: {
      open: (connection, { adapterSettings: { WS_API_USERNAME, WS_API_PASSWORD } }) => {
        logger.debug('Opening WS connection')

        return new Promise((resolve) => {
          connection.addEventListener('message', (event: MessageEvent) => {
            const { msg, sta } = JSON.parse(event.data.toString())
            if (msg === 'auth' && sta === 1) {
              logger.info('Got logged in response, connection is ready')
              providerDataStreamEstablishedUnixMs = Date.now()
              resolve()
            }
          })
          const options = {
            msg: 'auth',
            user: WS_API_USERNAME,
            pass: WS_API_PASSWORD,
            mode: 'broadcast',
          }
          connection.send(JSON.stringify(options))
        })
      },
      message: (message) => {
        logger.debug({ msg: 'Received message from WS', message })

        const providerDataReceivedUnixMs = Date.now()

        if (!('msg' in message) || message.msg === 'auth') return []

        const { fvs, rec, sta } = message

        if (!fvs || !rec || sta !== 1) {
          logger.debug({ msg: 'Missing expected field `fvs` or `rec` from `sub` message', message })
          return []
        }

        // Check for a heartbeat message, refresh the TTLs of all requested entries in the cache
        if (rec.includes('HBHHH')) {
          const stream = rec.slice(22, 24)
          if (stream === generatePriceOptions.streamName) {
            logger.debug({
              msg: 'Received heartbeat message from WS, updating TTLs of active entries',
              message,
            })
            updateTTL(tpTransport)
            return []
          }
        }

        const stream = rec.slice(31, 34)
        if (stream !== generatePriceOptions.streamName) {
          logger.debug({
            msg: `Only ${generatePriceOptions.streamName} forex prices accepted on this adapter. Filtering out this message.`,
            message,
          })
          return []
        }

        const { ASK, BID, MID_PRICE } = fvs

        if (!isNum(MID_PRICE) && !(isNum(BID) && isNum(ASK))) {
          const errorMessage = '`sub` message did not include required price fields'
          logger.debug({ errorMessage, message })
          return []
        }

        const result =
          MID_PRICE ||
          new Decimal(ASK as number)
            .add(BID as number)
            .div(2)
            .toNumber()

        const base = rec.slice(5, 8)
        const quote = rec.slice(8, 11)
        const source = rec.slice(15, 18)

        return [
          {
            params: { base, quote, [generatePriceOptions.sourceName]: source },
            response: {
              result,
              data: {
                result,
              },
              timestamps: {
                providerDataReceivedUnixMs,
                providerDataStreamEstablishedUnixMs,
                providerIndicatedTimeUnixMs: undefined,
              },
            },
          },
        ] as unknown as ProviderResult<WsTransportTypes>[]
      },
    },
  })
  return tpTransport
}
