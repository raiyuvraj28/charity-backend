const mongoose = require('mongoose');
const ReviewSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  email:   { type: String, required: true },
  rating:  { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  approved:{ type: Boolean, default: true }
}, { timestamps: true });
module.exports = mongoose.model('Review', ReviewSchema);
