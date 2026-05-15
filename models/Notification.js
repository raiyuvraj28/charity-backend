const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  audience:    { type: String, enum: ['admin', 'user', 'donor'], required: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  type:        { type: String, required: true },
  title:       { type: String, required: true },
  message:     { type: String, required: true },
  icon:        { type: String, default: '🔔' },
  link:        { type: String, default: '' },
  read:        { type: Boolean, default: false },
  meta:        { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
