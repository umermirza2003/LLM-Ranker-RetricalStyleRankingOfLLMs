const { getDashboardSummary } = require('../db/responseDb')

function getDashboard(_req, res) {
  try {
    const data = getDashboardSummary()
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Dashboard summary failed.' })
  }
}

module.exports = {
  getDashboard,
}
