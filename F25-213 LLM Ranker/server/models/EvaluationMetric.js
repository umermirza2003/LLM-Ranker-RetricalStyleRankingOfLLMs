const mongoose = require('mongoose')

const evaluationMetricSchema = new mongoose.Schema({
  MetricID: {
    type: Number,
    required: true,
    unique: true
  },
  ResponseID: {
    type: Number,
    required: true,
    ref: 'Response'
  },
  MetricName: {
    type: String,
    required: true,
    maxlength: 50,
    trim: true,
    enum: ['BLEU', 'ROUGE', 'METEOR', 'BERTScore', 'Custom', 'UserRating']
  },
  Score: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  }
}, {
  timestamps: true,
  collection: 'evaluationmetrics'
})

// Indexes for faster queries
evaluationMetricSchema.index({ MetricID: 1 })
evaluationMetricSchema.index({ ResponseID: 1 })
evaluationMetricSchema.index({ MetricName: 1 })
// Compound index for common queries
evaluationMetricSchema.index({ ResponseID: 1, MetricName: 1 })

// Auto-increment MetricID
evaluationMetricSchema.pre('save', async function(next) {
  if (this.isNew && !this.MetricID) {
    try {
      const Counter = mongoose.model('Counter') || mongoose.model('Counter', new mongoose.Schema({
        _id: { type: String, required: true },
        seq: { type: Number, default: 0 }
      }))
      
      const counter = await Counter.findByIdAndUpdate(
        'metricid',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      )
      
      this.MetricID = counter.seq
    } catch (error) {
      return next(error)
    }
  }
  next()
})

const EvaluationMetric = mongoose.model('EvaluationMetric', evaluationMetricSchema)

module.exports = EvaluationMetric

