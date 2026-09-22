const path = require('path')
const dotenv = require('dotenv')

// Load environment variables from server/.env
dotenv.config({ path: path.resolve(__dirname, './.env') })

const { createApp } = require('./src/app')
const { warmupDatabase } = require('./src/db/responseDb')

warmupDatabase()

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000

const app = createApp()

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] Listening on port ${PORT}`)
})

