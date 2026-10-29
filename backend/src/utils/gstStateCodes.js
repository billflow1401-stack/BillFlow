/**
 * BillFlow-Pro — Indian GST State Codes & Legal Utilities
 * Official 2-digit state code mappings per GST Council / CBIC.
 */

const STATE_CODE_MAP = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory'
};

// Case-insensitive normalized name to code map
const NORMALIZED_NAME_TO_CODE = {};
for (const [code, name] of Object.entries(STATE_CODE_MAP)) {
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  NORMALIZED_NAME_TO_CODE[norm] = code;
}

// Add common aliases
NORMALIZED_NAME_TO_CODE['jk'] = '01';
NORMALIZED_NAME_TO_CODE['jammu'] = '01';
NORMALIZED_NAME_TO_CODE['hp'] = '02';
NORMALIZED_NAME_TO_CODE['uk'] = '05';
NORMALIZED_NAME_TO_CODE['up'] = '09';
NORMALIZED_NAME_TO_CODE['wb'] = '19';
NORMALIZED_NAME_TO_CODE['bengal'] = '19';
NORMALIZED_NAME_TO_CODE['mp'] = '23';
NORMALIZED_NAME_TO_CODE['mh'] = '27';
NORMALIZED_NAME_TO_CODE['ka'] = '29';
NORMALIZED_NAME_TO_CODE['tn'] = '33';
NORMALIZED_NAME_TO_CODE['ts'] = '36';
NORMALIZED_NAME_TO_CODE['ap'] = '37';
NORMALIZED_NAME_TO_CODE['damananddiu'] = '26';
NORMALIZED_NAME_TO_CODE['dadranagarhaveli'] = '26';
NORMALIZED_NAME_TO_CODE['dadraandnagarhaveli'] = '26';
NORMALIZED_NAME_TO_CODE['dnhdd'] = '26';
NORMALIZED_NAME_TO_CODE['orissa'] = '21';
NORMALIZED_NAME_TO_CODE['pondicherry'] = '34';

/**
 * Normalizes a state name to canonical title case name.
 * @param {string} stateInput 
 * @returns {string|null}
 */
const normalizeStateName = (stateInput) => {
  if (!stateInput || typeof stateInput !== 'string') return null;
  const trimmed = stateInput.trim();
  if (!trimmed) return null;

  // Check if already a 2-digit code
  if (/^\d{2}$/.test(trimmed)) {
    return STATE_CODE_MAP[trimmed] || trimmed;
  }

  const clean = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  const code = NORMALIZED_NAME_TO_CODE[clean];
  if (code && STATE_CODE_MAP[code]) {
    return STATE_CODE_MAP[code];
  }

  // Capitalize words as fallback
  return trimmed.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

/**
 * Returns the 2-digit GST state code for a given state name or code.
 * @param {string} stateInput 
 * @returns {string|null}
 */
const getStateCode = (stateInput) => {
  if (!stateInput || typeof stateInput !== 'string') return null;
  const trimmed = stateInput.trim();
  if (/^\d{2}$/.test(trimmed)) {
    return STATE_CODE_MAP[trimmed] ? trimmed : null;
  }
  const clean = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  return NORMALIZED_NAME_TO_CODE[clean] || null;
};

/**
 * Extracts 2-digit state code from GSTIN.
 * @param {string} gstin 
 * @returns {string|null}
 */
const getStateCodeFromGstin = (gstin) => {
  if (!gstin || typeof gstin !== 'string') return null;
  const trimmed = gstin.trim().toUpperCase();
  if (/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(trimmed)) {
    const code = trimmed.substring(0, 2);
    return STATE_CODE_MAP[code] ? code : null;
  }
  return null;
};

/**
 * Validates whether a GSTIN matches a specified state.
 * @param {string} gstin 
 * @param {string} state 
 * @returns {boolean}
 */
const isGstinStateMatching = (gstin, state) => {
  const gstinCode = getStateCodeFromGstin(gstin);
  const stateCode = getStateCode(state);
  if (!gstinCode || !stateCode) return false;
  return gstinCode === stateCode;
};

/**
 * List of all standard Indian states and UTs with their codes.
 */
const ALL_STATES = Object.entries(STATE_CODE_MAP).map(([code, name]) => ({
  code,
  name
})).sort((a, b) => a.name.localeCompare(b.name));

module.exports = {
  STATE_CODE_MAP,
  ALL_STATES,
  normalizeStateName,
  getStateCode,
  getStateCodeFromGstin,
  isGstinStateMatching
};
