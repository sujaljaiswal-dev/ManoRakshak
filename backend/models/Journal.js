const mongoose = require('mongoose');

const journalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  mood: {
    type: String,
    enum: ['great', 'good', 'okay', 'low', 'terrible'],
    default: 'okay',
  },
  stressScore: {
    type: Number,
    default: 0,
  },
  aiSummary: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Journal', journalSchema);
