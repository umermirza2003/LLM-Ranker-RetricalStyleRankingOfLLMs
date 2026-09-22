const express = require('express')
const cors = require('cors')

const { providersRouter } = require('./routes/providers.route')
const { askRouter } = require('./routes/ask.route')
const { postRankResponses } = require('./routes/rankResponses.route')
const {
  getQueryHistory,
  getQueryHistoryBatch,
} = require('./routes/queryHistory.route')
const { postCustomRanking } = require('./routes/customRanking.route')
const { getModelStatisticsRoute } = require('./routes/modelStatistics.route')
const { getDashboard } = require('./routes/dashboard.route')
const { postDatasetTrain } = require('./routes/datasetTrain.route')

function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '12mb' }))

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true })
  })

  /**
   * Dataset training — mounted as /api Router so path is reliably POST /api/dataset-train
   * (Express 5 + some proxies handle this more reliably than a single app.post).
   */
  const datasetApiRouter = express.Router()
  datasetApiRouter.get('/dataset-train', (_req, res) => {
    res.status(200).json({
      ok: true,
      message:
        'Dataset train is available. POST JSON: { "query": string, "rows": [{ "llm", "response", "id"? }] }',
    })
  })
  datasetApiRouter.post('/dataset-train', postDatasetTrain)
  app.use('/api', datasetApiRouter)

  app.post('/dataset-train', postDatasetTrain)

  app.use('/', providersRouter)
  app.use('/', askRouter)

  app.post('/rank-responses', postRankResponses)
  app.post('/api/rank-responses', postRankResponses)

  app.get('/query-history', getQueryHistory)
  app.get('/query-history/:batchId', getQueryHistoryBatch)
  app.get('/api/query-history', getQueryHistory)
  app.get('/api/query-history/:batchId', getQueryHistoryBatch)

  app.post('/custom-ranking', postCustomRanking)
  app.post('/api/custom-ranking', postCustomRanking)

  app.get('/api/model-statistics', getModelStatisticsRoute)
  app.get('/api/dashboard-summary', getDashboard)

  app.use((err, _req, res, _next) => {
    // Central error handler for production-safe JSON responses
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500
    res.status(status).json({
      error: err.message || 'Internal Server Error',
    })
  })

  return app
}

module.exports = { createApp }

