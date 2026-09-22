const mongoose = require('mongoose')

const queryHistorySchema = new mongoose.Schema({
  QueryHistoryID: {
    type: Number,
    required: true,
    unique: true
  },
  UserID: {
    type: Number,
    required: true,
    ref: 'User'
  },
  PromptID: {
    type: Number,
    required: true,
    ref: 'Prompt'
  },
  QueryText: {
    type: String,
    required: true
  },
  NumberOfLLMs: {
    type: Number,
    required: true,
    min: 1
  },
  BestLLM: {
    type: String,
    maxlength: 100,
    default: null
  },
  CreatedAt: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true,
  collection: 'queryhistories'
})

// Indexes for faster queries
queryHistorySchema.index({ QueryHistoryID: 1 })
queryHistorySchema.index({ UserID: 1 })
queryHistorySchema.index({ PromptID: 1 })
queryHistorySchema.index({ CreatedAt: -1 })
// Compound index for user's query history
queryHistorySchema.index({ UserID: 1, CreatedAt: -1 })

// Auto-increment QueryHistoryID
queryHistorySchema.pre('save', async function(next) {
  if (this.isNew && !this.QueryHistoryID) {
    try {
      const Counter = mongoose.model('Counter') || mongoose.model('Counter', new mongoose.Schema({
        _id: { type: String, required: true },
        seq: { type: Number, default: 0 }
      }))
      
      const counter = await Counter.findByIdAndUpdate(
        'queryhistoryid',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      )
      
      this.QueryHistoryID = counter.seq
    } catch (error) {
      return next(error)
    }
  }
  next()
})

const QueryHistory = mongoose.model('QueryHistory', queryHistorySchema)

module.exports = QueryHistory

