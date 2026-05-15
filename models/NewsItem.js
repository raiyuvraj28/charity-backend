const mongoose = require('mongoose');

const NewsItemSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  date:        { type: String, required: true },
  imageUrl:    { type: String, default: '' },
  published:   { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('NewsItem', NewsItemSchema);
