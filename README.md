## CodeVista Backend

Node.js + Express backend for authentication and profile management.

## Overview

This backend provides:

- email/password signup
- email/password signin
- Firebase social signin through ID token verification
- protected profile retrieval
- MongoDB persistence for user accounts

## Project structure

- [src/app.js](src/app.js): Express app and middleware setup
- [src/index.js](src/index.js): server bootstrap and database connection
- [src/config](src/config): environment and database configuration
- [src/controllers](src/controllers): request handlers
- [src/services](src/services): business logic
- [src/models](src/models): MongoDB schemas
- [src/routes](src/routes): API routes
- [src/middlewares](src/middlewares): auth and error handling
- [src/utils](src/utils): shared helpers

## Prerequisites

- Node.js 18+
- MongoDB database
- Firebase project for social authentication

## Setup

1. Install dependencies:

   - npm install

2. Create a .env file from [.env.example](.env.example):

   - MONGODB_URI=
   - JWT_SECRET=
   - JWT_EXPIRES_IN=7d
   - FIREBASE_PROJECT_ID=
   - FIREBASE_CLIENT_EMAIL=
   - FIREBASE_PRIVATE_KEY=
   - PORT=5000

3. Start the server:

   - npm run dev

## Scripts

- npm start: run the server
- npm run dev: run with nodemon
- npm test: placeholder test script

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| MONGODB_URI | Yes | MongoDB connection string |
| JWT_SECRET | Yes | Secret used to sign app JWTs |
| JWT_EXPIRES_IN | No | JWT expiration time, default 7d |
| FIREBASE_PROJECT_ID | Optional* | Firebase project id for admin auth |
| FIREBASE_CLIENT_EMAIL | Optional* | Firebase service account email |
| FIREBASE_PRIVATE_KEY | Optional* | Firebase service account private key |
| PORT | No | Server port, default 5000 |

*If Firebase service account credentials are not provided, the app falls back to Google application default credentials.

## Authentication flow

### Email/password signup

1. Client sends name, email, and password.
2. Backend hashes the password with bcrypt.
3. User is stored in MongoDB.
4. Backend returns an app JWT and the user profile.

### Email/password signin

1. Client sends email and password.
2. Backend compares the password hash.
3. Backend returns an app JWT and the user profile.

### Firebase social signin

1. Client signs in with Firebase Authentication using Google, Apple, Facebook, or another provider.
2. Client sends the Firebase ID token to the backend.
3. Backend verifies the token with Firebase Admin SDK.
4. Backend creates or updates the user record.
5. Backend returns an app JWT and the user profile.

## API reference

### POST /api/auth/signup

Creates a local account.

Request body:

- name
- email
- password
- photoURL optional

### POST /api/auth/signin

Signs in a local account.

Request body:

- email
- password

### POST /api/auth/firebase

Verifies a Firebase ID token and signs the user into the app.

Request body:

- idToken

### GET /api/auth/profile

Returns the current authenticated user's profile.

Headers:

- Authorization: Bearer <app-jwt>

## Response shape

Successful auth endpoints return:

- success: true
- token: app JWT
- user: profile data

## User data model

Stored fields include:

- name
- email
- passwordHash for local accounts
- photoURL
- firebaseUid
- authProviders
- primaryAuthProvider
- lastLoginAt

## Notes

- Passwords are never returned in API responses.
- Firebase login should be handled on the client using Firebase SDK.
- The backend only verifies Firebase ID tokens and issues its own JWT for app access.
