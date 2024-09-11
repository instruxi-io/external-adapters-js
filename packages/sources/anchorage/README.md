# ANCHORAGE

![v3](https://img.shields.io/badge/framework%20version-v3-blueviolet)

## Environment Variables

| Required? |          Name           |                                        Description                                        |  Type  | Options | Default |
| :-------: | :---------------------: | :---------------------------------------------------------------------------------------: | :----: | :-----: | :-----: |
|    ✅     | {API_KEY_NAME}\_API_KEY |                                 An API key for Anchorage                                  | string |         |         |
|    ✅     |      API_ENDPOINT       |                               An API endpoint for Anchorage                               | string |         |         |
|           |        API_LIMIT        |                   The maximum number of results to request from the API                   | number |         |  `50`   |
|           |  BACKGROUND_EXECUTE_MS  | The amount of time the background execute should sleep before performing the next request | number |         | `10000` |

---

## Data Provider Rate Limits

There are no rate limits for this adapter.

---

## Input Parameters

| Required? |   Name   |     Description     |  Type  |          Options           | Default  |
| :-------: | :------: | :-----------------: | :----: | :------------------------: | :------: |
|           | endpoint | The endpoint to use | string | [wallet](#wallet-endpoint) | `wallet` |

## Wallet Endpoint

`wallet` is the only supported name for this endpoint.

### Input Params

| Required? |    Name    |  Aliases  |                          Description                           |  Type  |       Options        |  Default  | Depends On | Not Valid With |
| :-------: | :--------: | :-------: | :------------------------------------------------------------: | :----: | :------------------: | :-------: | :--------: | :------------: |
|    ✅     |  vaultId   | `vaultID` |                           customerId                           | string |                      |           |            |                |
|           |  chainId   |           |                 The ID of the chain to return                  | string | `mainnet`, `testnet` | `mainnet` |            |                |
|           |  network   |           |                     The network to return                      | string |                      | `bitcoin` |            |                |
|    ✅     | apiKeyName |           | Used to select {$apiKeyName}\_API_KEY in environment variables | string |                      |           |            |                |

### Example

Request:

```json
{
  "data": {
    "endpoint": "wallet",
    "vaultId": "22ds243sa24f652dsa3",
    "chainId": "mainnet",
    "network": "bitcoin",
    "apiKeyName": "BTC"
  }
}
```

---

MIT License