const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  UserID: {
    type: Number,
    required: true,
    unique: true,
    auto: true
  },
  Username: {
    type: String,
    required: true,
    maxlength: 50,
    trim: true,
    unique: true
  },
  Email: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true,
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  Password: {
    type: String,
    required: true,
    maxlength: 255
  },
  Role: {
    type: String,
    required: true,
    maxlength: 20,
    enum: ['Admin', 'User'],
    default: 'User'
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  collection: 'users'
})

// Create index on UserID for faster queries
userSchema.index({ UserID: 1 })

// Create index on Email for faster login queries
userSchema.index({ Email: 1 })

// Create index on Username for faster queries
userSchema.index({ Username: 1 })

// Auto-increment UserID using counter collection pattern
userSchema.pre('save', async function(next) {
  if (this.isNew && !this.UserID) {
    try {
      const Counter = mongoose.model('Counter') || mongoose.model('Counter', new mongoose.Schema({
        _id: { type: String, required: true },
        seq: { type: Number, default: 0 }
      }))
      
      const counter = await Counter.findByIdAndUpdate(
        'userid',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      )
      
      this.UserID = counter.seq
    } catch (error) {
      return next(error)
    }
  }
  next()
})

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject()
  delete userObject.Password
  return userObject
}

const User = mongoose.model('User', userSchema)

module.exports = User

