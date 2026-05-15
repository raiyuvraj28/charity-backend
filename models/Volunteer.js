const mongoose = require('mongoose');
const VolunteerSchema = new mongoose.Schema({
  volunteerId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  interest: { type: String, required: true },
  status: { type: String, default: 'Active' }
}, { timestamps: true });
module.exports = mongoose.model('Volunteer', VolunteerSchema);
