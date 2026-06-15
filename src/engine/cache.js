/**
 * PulseGuard AI - Response Cache
 * 
 * Caches AI responses so repeated demo runs are instant.
 * In demo mode, always returns cached/fallback responses.
 */

const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  // Cache entries valid for 10 minutes
  if (Date.now() - entry.timestamp > 10 * 60 * 1000) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  cache.set(key, { value, timestamp: Date.now() });
}

function clearCache() {
  cache.clear();
}

function isDemoMode() {
  return process.env.DEMO_MODE === 'true';
}

module.exports = { getCached, setCached, clearCache, isDemoMode };
