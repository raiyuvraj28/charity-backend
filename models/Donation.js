const mongoose = require('mongoose');
const DonationSchema = new mongoose.Schema({
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  transactionId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  amount: { type: Number, required: true },
  method: { type: String, required: true },
  status: { type: String, default: 'Completed' },
  frequency: { type: String, default: 'One Time' }
}, { timestamps: true });
module.exports = mongoose.model('Donation', DonationSchema);
