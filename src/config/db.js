const mongoose = require('mongoose');
const env = require('./env');

async function connectDB() {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is not set');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const dbName = process.env.DB_NAME || 'CodeVistaDb';
  await mongoose.connect(env.mongoUri, { dbName });
  return mongoose.connection;
}

module.exports = connectDB;
