require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User.model');

const name = process.env.ADMIN_NAME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

const fail = (message) => {
  console.error(`Admin seeding failed: ${message}`);
  process.exitCode = 1;
};

const main = async () => {
  if (!name) {
    fail('ADMIN_NAME is required.');
    return;
  }
  if (!email) {
    fail('ADMIN_EMAIL is required.');
    return;
  }
  if (!password) {
    fail('ADMIN_PASSWORD is required.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('ADMIN_EMAIL must be a valid email address.');
    return;
  }
  if (password.length < 8) {
    fail('ADMIN_PASSWORD must be at least 8 characters.');
    return;
  }
  if (!env.MONGODB_URI) {
    fail('MONGODB_URI is required.');
    return;
  }

  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`Admin seeding skipped: a user with this email already exists (${email}).`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({
      name,
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
    });

    console.log(`Admin account created successfully (${email}).`);
  } catch (error) {
    fail(error.message);
  } finally {
    await mongoose.disconnect();
  }
};

main();
