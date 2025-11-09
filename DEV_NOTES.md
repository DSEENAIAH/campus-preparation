Developer notes — local AWS/DynamoDB fallback

- Purpose: The app normally uses Cognito and DynamoDB. In browser/dev without AWS credentials the AWS SDK throws "Credential is missing". To make local development easier, we add a local fallback user store used only when AWS credentials are missing or when placeholder AWS config is detected.

- File: `src/config/localUsers.js`
  - Contains `admin@codenvia.com` with password `admin123` and a `test@student.com` user with password `student123`.
  - This file is only used in dev and should never be used in production.

- Behavior:
  - If `VITE_COGNITO_USER_POOL_ID` or `VITE_COGNITO_CLIENT_ID` look like placeholders or the AWS SDK reports missing credentials, the app will fall back to `LOCAL_USERS` for login.
  - This allows logging in as `admin@codenvia.com` locally even without AWS credentials.

- Reminder: For production, configure proper AWS credentials via environment variables, IAM roles, or Cognito Identity Pools. Remove or ignore localUsers.js in production builds.
