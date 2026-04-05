// Proxy configuration for development
const PROXY_CONFIG = [
  {
    context: ['/api/v1'],
    target: 'http://localhost:8080',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: {
      '^/api/v1': '/api/v1',
    },
  },
];

module.exports = PROXY_CONFIG;
