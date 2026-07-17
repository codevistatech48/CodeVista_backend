# Firebase OAuth Setup & Client Example

This document explains how to enable Firebase Google and GitHub OAuth and exchange a Firebase ID token for the backend application JWT.

## 1) Enable providers in Firebase Console

1. Open the Firebase console: https://console.firebase.google.com
2. Select your project (`codevista-86a1a`).
3. Go to "Authentication" -> "Sign-in method".
4. Enable both **Google** and **GitHub** and save. GitHub additionally requires its OAuth client ID and client secret.
5. Go to **Authentication** -> **Settings** -> **Authorized domains** and add `localhost` plus each production frontend domain.

## 2) Add Web App and copy config

If you haven't already, register a Web App in Firebase and copy the config object (apiKey, authDomain, projectId, ...). You provided a config in your message; keep that in the client.

## 3) Minimal client example (Google Sign-in, Firebase v9 modular)

Create a simple HTML page or integrate into your app. This example uses the Firebase JS SDK v9 modular API.

File: `docs/firebase-client.html`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Firebase OAuth Example</title>
    <script type="module">
      // Import from the CDN or your bundler
      import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
      import { getAuth, signInWithPopup, GoogleAuthProvider, GithubAuthProvider } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

      const firebaseConfig = {
        apiKey: 'AIzaSyAR-GOxjmzLEYU6K89V1CKsKgRRDzSU1bs',
        authDomain: 'codevista-86a1a.firebaseapp.com',
        projectId: 'codevista-86a1a',
        storageBucket: 'codevista-86a1a.firebasestorage.app',
        messagingSenderId: '227576103044',
        appId: '1:227576103044:web:4d56f49f07bf7a9c2ac2d1',
        measurementId: 'G-1XRMGVBXYW'
      };

      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const API_URL = 'http://localhost:5000';

      async function signIn(provider) {
        try {
          const result = await signInWithPopup(auth, provider);
          const user = result.user;
          const firebaseIdToken = await user.getIdToken();

          // Send ID token to backend
          const resp = await fetch(`${API_URL}/api/auth/oauth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: firebaseIdToken }),
          });

          const data = await resp.json();
          if (!resp.ok) throw new Error(data.message || 'OAuth login failed');

          localStorage.setItem('userToken', data.token);
          window.location.assign('/dashboard');
        } catch (err) {
          alert(err.message);
        }
      }

      window.signInWithGoogle = () => signIn(new GoogleAuthProvider());
      window.signInWithGitHub = () => signIn(new GithubAuthProvider());
    </script>
  </head>
  <body>
    <h1>Firebase OAuth Example</h1>
    <button onclick="signInWithGoogle()">Sign in with Google</button>
    <button onclick="signInWithGitHub()">Sign in with GitHub</button>
  </body>
</html>
```

Notes:
- This example uses the Firebase CDN imports. In production, use a bundler (Vite/webpack) or module install.
- Do not store the Firebase ID token. Store the returned backend `token` in `localStorage` as `userToken`.

## 4) Backend requirements

- The backend uses `firebase-admin` to verify ID tokens. Never commit a service-account JSON file. Configure exactly one of these options in `.env`:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

or a base64-encoded complete service-account JSON:

```
FIREBASE_SERVICE_ACCOUNT_BASE64=base64-encoded-service-account-json
```

The private key must be the `private_key` from a Firebase/GCP service-account JSON. It is not the Firebase web `apiKey`.

Set `CORS_ORIGINS=http://localhost:5173,https://your-production-frontend.example` for the React frontend origins.

If you prefer, you can set `GOOGLE_APPLICATION_CREDENTIALS` to a JSON file path instead of using the `.env` fields.

## 5) Testing

1. Start your backend: `npm run dev`.
2. Serve `docs/firebase-client.html` (e.g., open file in browser or serve via a static server).
3. Click a provider button. After the popup, the client exchanges the Firebase ID token at `POST /api/auth/oauth` and receives the application JWT.

If you want, I can add a lightweight static route to serve this file from the backend for quick testing.
