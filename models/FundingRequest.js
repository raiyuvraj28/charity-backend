const mongoose = require('mongoose');

const FundingRequestSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:    { type: String, required: true },
  userEmail:   { type: String, required: true },
  title:       { type: String, required: true },
  description: { type: String, required: true },
  amount:      { type: Number, required: true },
  photoUrl:    { type: String, default: '' },   // base64 or URL
  status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote:   { type: String, default: '' },
  userMessage: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('FundingRequest', FundingRequestSchema);
