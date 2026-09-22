const mongoose = require('mongoose')

// Counter collection for auto-incrementing IDs
const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  seq: {
    type: Number,
    default: 0
  }
}, {
  collection: 'counters'
})

const Counter = mongoose.model('Counter', counterSchema)

module.exports = Counter

