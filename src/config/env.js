const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
  const examplePath = path.resolve(__dirname, '../../.env.example');

  if (fs.existsSync(examplePath)) {
    const exampleConfig = dotenv.parse(fs.readFileSync(examplePath));

    process.env.MONGODB_URI = exampleConfig.MONGODB_URI || process.env.MONGODB_URI;
    process.env.MONGO_URI = exampleConfig.MONGO_URI || process.env.MONGO_URI;
    process.env.JWT_SECRET = process.env.JWT_SECRET || exampleConfig.JWT_SECRET;
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || exampleConfig.JWT_EXPIRES_IN;
    process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || exampleConfig.FIREBASE_PROJECT_ID;
    process.env.FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || exampleConfig.FIREBASE_CLIENT_EMAIL;
    process.env.FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY || exampleConfig.FIREBASE_PRIVATE_KEY;
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || exampleConfig.FIREBASE_SERVICE_ACCOUNT_BASE64;
    process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || exampleConfig.CORS_ORIGINS;
    process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || exampleConfig.RESEND_API_KEY;
    process.env.RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || exampleConfig.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    process.env.PORT = process.env.PORT || exampleConfig.PORT;
  }
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || '',
  firebaseServiceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean),
  adminRateLimitWindowMs: Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  adminRateLimitMax: Number(process.env.ADMIN_RATE_LIMIT_MAX || 300),
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || '',
};

module.exports = env;
