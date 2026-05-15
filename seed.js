require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Admin, Campaign, Donation, Volunteer } = require('./models');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('MongoDB Connected for Seeding...');

  // Clear existing data
  await Admin.deleteMany();
  await Campaign.deleteMany();
  await Volunteer.deleteMany();
  await Donation.deleteMany();

  // Seed Admin
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('admin123', salt);
  await Admin.create({ name: 'Super Admin', email: 'admin@hopeandhelp.org', password: hashedPassword });
  console.log('Admin seeded (admin@hopeandhelp.org / admin123)');

  // Seed Campaigns
  await Campaign.insertMany([
    { campaignId: 'CMP-101', name: 'Child Education Fund', category: 'Education', raised: 450000, target: 500000, status: 'Active' },
    { campaignId: 'CMP-102', name: 'Flood Relief Assam', category: 'Disaster Relief', raised: 1200000, target: 1500000, status: 'Active' },
    { campaignId: 'CMP-103', name: 'Clean Water Rajasthan', category: 'Healthcare', raised: 250000, target: 1000000, status: 'Active' },
  ]);
  console.log('Campaigns seeded');

  // Seed Volunteers
  await Volunteer.insertMany([
    { volunteerId: 'VOL-001', name: 'Dheeraj Mehta', email: 'dheeraj.m@example.com', interest: 'Food Drive', status: 'Active' },
    { volunteerId: 'VOL-002', name: 'Kavita Iyer', email: 'kavita.i@example.com', interest: 'Teaching', status: 'Active' },
  ]);
  console.log('Volunteers seeded');

  // Seed Donations
  await Donation.insertMany([
    { transactionId: 'TRX-9823', name: 'Arjun Kumar', email: 'arjun.k@example.com', amount: 5000, method: 'UPI', frequency: 'One Time' },
    { transactionId: 'TRX-9824', name: 'Priya Sharma', email: 'priya.s@example.com', amount: 1500, method: 'Card', frequency: 'Monthly' },
  ]);
  console.log('Donations seeded');

  console.log('Seeding Complete! You can now run "node server.js"');
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
