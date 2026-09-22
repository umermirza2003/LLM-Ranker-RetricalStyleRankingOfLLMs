const mongoose = require('mongoose')

const rankingSchema = new mongoose.Schema({
  RankingID: {
    type: Number,
    required: true,
    unique: true
  },
  PromptID: {
    type: Number,
    required: true,
    ref: 'Prompt'
  },
  BestModel: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true
  },
  AverageScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  RankedAt: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true,
  collection: 'rankings'
})

// Indexes for faster queries
rankingSchema.index({ RankingID: 1 })
rankingSchema.index({ PromptID: 1 })
rankingSchema.index({ BestModel: 1 })
rankingSchema.index({ RankedAt: -1 })
rankingSchema.index({ AverageScore: -1 })

// Auto-increment RankingID
rankingSchema.pre('save', async function(next) {
  if (this.isNew && !this.RankingID) {
    try {
      const Counter = mongoose.model('Counter') || mongoose.model('Counter', new mongoose.Schema({
        _id: { type: String, required: true },
        seq: { type: Number, default: 0 }
      }))
      
      const counter = await Counter.findByIdAndUpdate(
        'rankingid',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      )
      
      this.RankingID = counter.seq
    } catch (error) {
      return next(error)
    }
  }
  next()
})

const Ranking = mongoose.model('Ranking', rankingSchema)

module.exports = Ranking

