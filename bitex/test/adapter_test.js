const assert = require('chai').assert
const createRequest = require('../adapter').createRequest

describe('createRequest', () => {
  const jobID = '1'

  context('successful calls', () => {
    const requests = [
      { name: 'id not supplied', testData: { data: { base: 'BTC', quote: 'ARS' } } },
      { name: 'base/quote', testData: { id: jobID, data: { base: 'BTC', quote: 'ARS' } } },
      { name: 'from/to', testData: { id: jobID, data: { from: 'BTC', to: 'ARS' } } },
      { name: 'coin/market', testData: { id: jobID, data: { coin: 'BTC', market: 'ARS' } } }
    ]

    requests.forEach(req => {
      it(`${req.name}`, (done) => {
        createRequest(req.testData, (statusCode, data) => {
          assert.equal(statusCode, 200)
          assert.equal(data.jobRunID, jobID)
          assert.isNotEmpty(data.data)
          assert.isAbove(data.result, 0)
          assert.isAbove(data.data.result, 0)
          done()
        })
      })
    })
  })

  context('error calls', () => {
    const requests = [
      { name: 'empty body', testData: {} },
      { name: 'empty data', testData: { data: {} } },
      { name: 'base not supplied', testData: { id: jobID, data: { quote: 'ARS' } } },
      { name: 'quote not supplied', testData: { id: jobID, data: { base: 'BTC' } } },
      { name: 'unknown base', testData: { id: jobID, data: { base: 'not_real', quote: 'ARS' } } },
      { name: 'unknown quote', testData: { id: jobID, data: { base: 'BTC', quote: 'not_real' } } }
    ]

    requests.forEach(req => {
      it(`${req.name}`, (done) => {
        createRequest(req.testData, (statusCode, data) => {
          assert.equal(statusCode, 500)
          assert.equal(data.jobRunID, jobID)
          assert.equal(data.status, 'errored')
          assert.isNotEmpty(data.error)
          done()
        })
      })
    })
  })
})
