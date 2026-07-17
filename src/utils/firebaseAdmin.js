const admin = require('firebase-admin');
const env = require('../config/env');

function getServiceAccount() {
  if (env.firebaseServiceAccountBase64) {
    try {
      const serviceAccount = JSON.parse(Buffer.from(env.firebaseServiceAccountBase64, 'base64').toString('utf8'));

      if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
        throw new Error('Missing required fields');
      }

      return {
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      };
    } catch (_error) {
      throw new Error('Firebase Admin service account configuration is invalid');
    }
  }

  const privateKey = env.firebasePrivateKey.replace(/\\n/g, '\n').trim();

  if (!env.firebaseProjectId || !env.firebaseClientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials are not configured');
  }

  if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
    throw new Error('FIREBASE_PRIVATE_KEY must be a Firebase service-account private key');
  }

  return {
    projectId: env.firebaseProjectId,
    clientEmail: env.firebaseClientEmail,
    privateKey,
  };
}

function initializeFirebaseAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(getServiceAccount()) });
  }

  return admin;
}

module.exports = { initializeFirebaseAdmin };
