const admin = require('firebase-admin');
const env = require('../config/env');

let initialized = false;

function getFirebasePrivateKey() {
  if (!env.firebasePrivateKey) {
    return '';
  }

  return env.firebasePrivateKey.replace(/\\n/g, '\n');
}

function initializeFirebaseAdmin() {
  if (initialized) {
    return admin;
  }

  if (admin.apps.length) {
    initialized = true;
    return admin;
  }

  if (env.firebaseProjectId && env.firebaseClientEmail && getFirebasePrivateKey()) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.firebaseProjectId,
        clientEmail: env.firebaseClientEmail,
        privateKey: getFirebasePrivateKey(),
      }),
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  initialized = true;
  return admin;
}

module.exports = { initializeFirebaseAdmin };