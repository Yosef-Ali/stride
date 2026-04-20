// Vercel catch-all serverless function. Delegates every /api/* request to
// the bundle produced by `expo export -p web` inside apps/mobile/dist/server.
const path = require('path');
const { createRequestHandler } = require('@expo/server/adapter/vercel');

module.exports = createRequestHandler({
  build: path.join(__dirname, '..', 'apps', 'mobile', 'dist', 'server'),
});
