#!/usr/bin/env node
/**
 * Wipes stored LLM responses: prefers deleting DB files (+ WAL/SHM).
 * If the OS reports the file busy (EBUSY), clears `llm_responses` in place instead.
 */

const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const { getDbPath, closeDatabase, clearAllLLMResponses } = require('../src/db/responseDb')

closeDatabase()

const main = getDbPath()
const extras = [`${main}-wal`, `${main}-shm`]
let unlinkOk = true
let unlinkErr

for (const f of [...extras, main]) {
  try {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f)
      // eslint-disable-next-line no-console
      console.log('Deleted', f)
    }
  } catch (err) {
    unlinkOk = false
    unlinkErr = err
    break
  }
}

if (unlinkOk) {
  // eslint-disable-next-line no-console
  console.log('[clear-sqlite-db] Database files removed. Next server start creates a fresh DB.')
  process.exit(0)
}

// eslint-disable-next-line no-console
console.warn('[clear-sqlite-db] Could not delete files:', unlinkErr?.message || unlinkErr)
// eslint-disable-next-line no-console
console.warn('[clear-sqlite-db] Clearing rows in place (another process may have the file open)...')

closeDatabase()
const result = clearAllLLMResponses()
closeDatabase()

if (!result.ok) {
  // eslint-disable-next-line no-console
  console.error('[clear-sqlite-db]', result.error)
  process.exit(1)
}

// eslint-disable-next-line no-console
console.log('[clear-sqlite-db] llm_responses table is empty. Query history starts fresh.')
