const express = require('express')

const { askAndRank } = require('../services/askService')
const { parseProviderIndices } = require('../utils/parseProviderIndices')

const askRouter = express.Router()

askRouter.post('/ask', async (req, res, next) => {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
    if (!query) {
      return res
        .status(400)
        .json({
          error: 'Body must include { "query": "..." }; optional "providerIndices": [ 1, 2 ] for API slots.',
        })
    }

    const providerIndices = parseProviderIndices(req.body)
    const ranked = await askAndRank(query, providerIndices)
    return res.status(200).json({
      query,
      results: ranked,
    })
  } catch (err) {
    return next(err)
  }
})

module.exports = { askRouter }

