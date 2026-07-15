# API Reference

## Health check

### GET /health

Returns service status.

Response:

- success: true
- message: Backend is running

## Authentication

### POST /api/auth/signup

Creates a new local user.

Request body:

- name: string
- email: string
- password: string
- photoURL: string optional

Response:

- success: true
- token: string
- user: object

### POST /api/auth/signin

Authenticates a local user.

Request body:

- email: string
- password: string

Response:

- success: true
- token: string
- user: object

### POST /api/auth/firebase

Authenticates a Firebase user.

Request body:

- idToken: string

Response:

- success: true
- token: string
- user: object

### GET /api/auth/profile

Returns the current user profile.

Headers:

- Authorization: Bearer <app-jwt>

Response:

- success: true
- user: object

## Common error responses

- 400: validation error or missing fields
- 401: unauthorized or invalid token
- 404: route or resource not found
- 409: duplicate user
- 500: server error

## Example client usage

1. Sign in with Firebase on the frontend using Google, Apple, Facebook, or another provider.
2. Send the Firebase ID token to POST /api/auth/firebase.
3. Store the returned app JWT securely.
4. Include the JWT in the Authorization header for protected routes.
