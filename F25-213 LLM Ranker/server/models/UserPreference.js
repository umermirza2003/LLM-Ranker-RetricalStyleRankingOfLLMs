const mongoose = require('mongoose')

const userPreferenceSchema = new mongoose.Schema({
  PreferenceID: {
    type: Number,
    required: true,
    unique: true
  },
  UserID: {
    type: Number,
    required: true,
    ref: 'User',
    unique: true // One preference record per user
  },
  SelectedModels: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= 29 // Max 29 models as per your app
      },
      message: 'Cannot select more than 29 models'
    }
  },
  RankingsOrder: {
    type: [{
      name: { type: String, required: true },
      order: { type: Number, required: true },
      score: { type: Number, default: 0 }
    }],
    default: []
  },
  Theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light'
  },
  Avatar: {
    type: String, // Base64 encoded image or URL
    default: null
  }
}, {
  timestamps: true,
  collection: 'userpreferences'
})

// Indexes
userPreferenceSchema.index({ PreferenceID: 1 })
userPreferenceSchema.index({ UserID: 1 })

// Auto-increment PreferenceID
userPreferenceSchema.pre('save', async function(next) {
  if (this.isNew && !this.PreferenceID) {
    try {
      const Counter = mongoose.model('Counter') || mongoose.model('Counter', new mongoose.Schema({
        _id: { type: String, required: true },
        seq: { type: Number, default: 0 }
      }))
      
      const counter = await Counter.findByIdAndUpdate(
        'preferenceid',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      )
      
      this.PreferenceID = counter.seq
    } catch (error) {
      return next(error)
    }
  }
  next()
})

const UserPreference = mongoose.model('UserPreference', userPreferenceSchema)

module.exports = UserPreference

