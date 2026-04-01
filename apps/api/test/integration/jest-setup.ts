process.env.NODE_ENV = 'test';
if (!process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-min-32-chars!!';
}
if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-min-32-chars!!';
}
if (!process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN = 'http://localhost:5173';
}
if (!process.env.SUPPORT_API_KEY) {
  process.env.SUPPORT_API_KEY = 'integration-test-support-api-key';
}
