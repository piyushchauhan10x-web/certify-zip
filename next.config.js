const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');
// Keep a running local dev server from overwriting production build manifests.
module.exports = (phase) => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
});
