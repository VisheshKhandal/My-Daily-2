const mongoose = require('mongoose');

const EntrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, default: 'Thought' }, // or 'Quote'
  tags: [String],
  mood: String,
  date: { type: String },
  time: { type: String },
  quote: String, // for commented quotes
  quoteAuthor: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Entry', EntrySchema); 