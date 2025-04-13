// src/js/utils.js
const DEBUG_NORMALIZATION = false;
const normalizationLogCache = new Set();
/**
 * Normalizza il nome di un'app per confronti più affidabili
 * @param {string} appName - Nome dell'app da normalizzare
 * @returns {string} Nome dell'app normalizzato
 */
function normalizeAppName(appName) {
    if (!appName || typeof appName !== 'string') return '';

    const trimmed = appName.trim();
    const normalized = trimmed.toLowerCase();
    const logKey = `${trimmed}=>${normalized}`;

    if (DEBUG_NORMALIZATION && !normalizationLogCache.has(logKey)) {
        console.log(`Normalizzazione: "${trimmed}" -> "${normalized}"`);
        normalizationLogCache.add(logKey);
    }

    return normalized;
}

module.exports = {
    normalizeAppName
};
