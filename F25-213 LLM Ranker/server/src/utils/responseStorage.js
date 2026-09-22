const fs = require('fs')
const path = require('path')

async function saveResponsesRecord({ query, results }) {
  const record = {
    query,
    results: Array.isArray(results) ? results : [],
  }

  const responsesPath = path.resolve(__dirname, '../../responses.json')
  const tmpPath = `${responsesPath}.tmp`

  const json = JSON.stringify(record, null, 2)
  await fs.promises.writeFile(tmpPath, json, 'utf-8')
  await fs.promises.rename(tmpPath, responsesPath)
}

module.exports = { saveResponsesRecord }

