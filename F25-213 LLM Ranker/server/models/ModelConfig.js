const mongoose = require('mongoose')

const modelConfigSchema = new mongoose.Schema({
  ModelID: {
    type: Number,
    required: true,
    unique: true
  },
  ModelName: {
    type: String,
    required: true,
    unique: true,
    maxlength: 100,
    trim: true
  },
  DisplayName: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true
  },
  Description: {
    type: String,
    default: ''
  },
  IsActive: {
    type: Boolean,
    default: true
  },
  APIEndpoint: {
    type: String,
    default: null
  },
  APIConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  CreatedAt: {
    type: Date,
    default: Date.now
  },
  UpdatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'modelconfigs'
})

// Indexes
modelConfigSchema.index({ ModelID: 1 })
modelConfigSchema.index({ ModelName: 1 })
modelConfigSchema.index({ IsActive: 1 })

// Auto-increment ModelID
modelConfigSchema.pre('save', async function(next) {
  if (this.isNew && !this.ModelID) {
    try {
      const Counter = mongoose.model('Counter') || mongoose.model('Counter', new mongoose.Schema({
        _id: { type: String, required: true },
        seq: { type: Number, default: 0 }
      }))
      
      const counter = await Counter.findByIdAndUpdate(
        'modelid',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      )
      
      this.ModelID = counter.seq
    } catch (error) {
      return next(error)
    }
  }
  this.UpdatedAt = Date.now()
  next()
})

const ModelConfig = mongoose.model('ModelConfig', modelConfigSchema)

module.exports = ModelConfig

