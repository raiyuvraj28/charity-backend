const mongoose = require('mongoose');
const CampaignSchema = new mongoose.Schema({
  campaignId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  raised: { type: Number, default: 0 },
  target: { type: Number, required: true },
  status: { type: String, default: 'Active' }
}, { timestamps: true });
module.exports = mongoose.model('Campaign', CampaignSchema);
