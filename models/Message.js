const mongoose = require('mongoose');
const MessageSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true },
  message:   { type: String, required: true },
  replied:   { type: Boolean, default: false },
  replyText: { type: String, default: '' },
  repliedAt: { type: Date }
}, { timestamps: true });
module.exports = mongoose.model('Message', MessageSchema);
