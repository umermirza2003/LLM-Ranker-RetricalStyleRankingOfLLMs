const { getModelStatistics } = require('../db/responseDb')

function getModelStatisticsRoute(_req, res) {
  try {
    const data = getModelStatistics()
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Statistics failed.' })
  }
}

module.exports = {
  getModelStatisticsRoute,
}
