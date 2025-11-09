// Local dev fallback users. Only used when AWS credentials are not available
// or when running in a local dev/browser environment where the SDK cannot
// obtain credentials. Do NOT use this in production.
export const LOCAL_USERS = {
  'admin@codenvia.com': {
    email: 'admin@codenvia.com',
    name: 'Admin User',
    role: 'admin',
    status: 'active',
    password: 'admin123',
    avatar: '👨💼',
    createdAt: new Date().toISOString()
  },
  // Example test/student user
  'test@student.com': {
    email: 'test@student.com',
    name: 'Test Student',
    role: 'student',
    status: 'active',
    password: 'student123',
    avatar: '👤',
    createdAt: new Date().toISOString()
  }
};
