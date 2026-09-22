const express = require('express')

const { getPublicProvidersCatalog, getMaxSlots } = require('../config/providersConfig')

const providersRouter = express.Router()

providersRouter.get('/providers', (_req, res) => {
  res.status(200).json({
    maxSlots: getMaxSlots(),
    providers: getPublicProvidersCatalog(),
  })
})

module.exports = { providersRouter }
