# Architecture

## Stack

- Node.js
- Express
- MongoDB with Mongoose
- JWT for app authentication
- Firebase Admin SDK for social login verification

## Request flow

1. Client sends request to an auth endpoint.
2. Controller receives the request and passes it to the service layer.
3. Service layer performs the business logic.
4. MongoDB stores or updates the user record.
5. A JWT is issued for application access.

## Layers

### App layer

- [src/app.js](../src/app.js) sets up Express, middleware, routes, and error handling.

### Controller layer

- Handles HTTP requests and responses.

### Service layer

- Contains signup, signin, Firebase login, and profile lookup logic.

### Model layer

- Defines the MongoDB user schema.

### Middleware layer

- `auth` middleware validates the app JWT.
- Error middleware formats API errors consistently.

## Firebase integration

Firebase is used only for identity verification. The backend does not rely on Firebase as the application session store. Instead:

- Firebase authenticates the user on the client.
- The client sends the Firebase ID token to the backend.
- The backend verifies the token.
- The backend issues its own JWT.

## Security notes

- Passwords are hashed with bcrypt.
- Password hashes are never selected in normal queries.
- Protected routes require a Bearer token.
- Invalid or expired tokens return a 401 response.
