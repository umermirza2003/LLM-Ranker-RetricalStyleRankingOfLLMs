const mongoose = require('mongoose')

const responseSchema = new mongoose.Schema({
  ResponseID: {
    type: Number,
    required: true,
    unique: true
  },
  PromptID: {
    type: Number,
    required: true,
    ref: 'Prompt'
  },
  ModelName: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true
  },
  ResponseText: {
    type: String,
    required: true
  },
  CreatedAt: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true,
  collection: 'responses'
})

// Indexes for faster queries
responseSchema.index({ ResponseID: 1 })
responseSchema.index({ PromptID: 1 })
responseSchema.index({ ModelName: 1 })
responseSchema.index({ CreatedAt: -1 })
// Compound index for common queries
responseSchema.index({ PromptID: 1, ModelName: 1 })

// Auto-increment ResponseID
responseSchema.pre('save', async function(next) {
  if (this.isNew && !this.ResponseID) {
    try {
      const Counter = mongoose.model('Counter') || mongoose.model('Counter', new mongoose.Schema({
        _id: { type: String, required: true },
        seq: { type: Number, default: 0 }
      }))
      
      const counter = await Counter.findByIdAndUpdate(
        'responseid',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      )
      
      this.ResponseID = counter.seq
    } catch (error) {
      return next(error)
    }
  }
  next()
})

const Response = mongoose.model('Response', responseSchema)

module.exports = Response

