const { runDatasetTrain } = require('../services/datasetTrainService')

function normalizeRow(r) {
  return {
    id: r?.id,
    llm: r?.llm,
    response: r?.response,
  }
}

async function postDatasetTrain(req, res, next) {
  try {
    const body = req.body || {}
    const runsIn = body.runs

    if (Array.isArray(runsIn) && runsIn.length > 0) {
      const runs = runsIn.map((run) => ({
        query: typeof run.query === 'string' ? run.query : '',
        sheetName: typeof run.sheetName === 'string' ? run.sheetName : '',
        rows: Array.isArray(run.rows) ? run.rows.map(normalizeRow) : [],
      }))

      const empty = runs.find((r) => !r.query.trim() || r.rows.length === 0)
      if (empty) {
        return res
          .status(400)
          .json({ error: 'Each run must include a non-empty query and at least one row.' })
      }

      const result = await runDatasetTrain({ runs })
      res.status(200).json(result)
      return
    }

    const query = typeof body.query === 'string' ? body.query : ''
    const rows = body.rows

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        error: 'Body must include query and a non-empty rows array, or a non-empty runs array.',
      })
    }

    const normalizedRows = rows.map(normalizeRow)

    const result = await runDatasetTrain({ query, rows: normalizedRows })
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

module.exports = { postDatasetTrain }
