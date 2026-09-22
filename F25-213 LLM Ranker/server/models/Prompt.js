const mongoose = require('mongoose')

const promptSchema = new mongoose.Schema({
  PromptID: {
    type: Number,
    required: true,
    unique: true
  },
  UserID: {
    type: Number,
    required: true,
    ref: 'User'
  },
  PromptText: {
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
  collection: 'prompts'
})

// Indexes for faster queries
promptSchema.index({ PromptID: 1 })
promptSchema.index({ UserID: 1 })
promptSchema.index({ CreatedAt: -1 })

// Auto-increment PromptID
promptSchema.pre('save', async function(next) {
  if (this.isNew && !this.PromptID) {
    try {
      const Counter = mongoose.model('Counter') || mongoose.model('Counter', new mongoose.Schema({
        _id: { type: String, required: true },
        seq: { type: Number, default: 0 }
      }))
      
      const counter = await Counter.findByIdAndUpdate(
        'promptid',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      )
      
      this.PromptID = counter.seq
    } catch (error) {
      return next(error)
    }
  }
  next()
})

const Prompt = mongoose.model('Prompt', promptSchema)

module.exports = Prompt

