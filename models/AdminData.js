const mongoose = require('mongoose');

const adminDataSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  location: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  orgId: { type: String, required: true, unique: true }
}, { timestamps: true });

const AdminData = mongoose.model('AdminData', adminDataSchema);

module.exports = AdminData;


