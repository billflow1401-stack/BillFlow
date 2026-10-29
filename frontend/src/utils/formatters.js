/**
 * Formats an integer string with Indian numbering system grouping.
 * e.g., '100000' -> '1,00,000', '10000000' -> '1,00,00,000'
 * @param {string} intStr
 * @returns {string}
 */
export function formatIndianIntegerString(intStr) {
  if (intStr.length <= 3) return intStr;
  const lastThree = intStr.slice(-3);
  const rest = intStr.slice(0, -3);
  const parts = [];
  let i = rest.length;
  while (i > 0) {
    const start = Math.max(0, i - 2);
    parts.unshift(rest.slice(start, i));
    i = start;
  }
  return parts.join(',') + ',' + lastThree;
}

/**
 * Formats rupee amount string/number into an INR currency string.
 * Example: '1250.50' -> '₹1,250.50'
 * Example: 1250.5 -> '₹1,250.50'
 * Rejects values with more than 2 decimal places or malformed values by returning '[Invalid Amount]'.
 * @param {string|number} amount
 * @param {Object} [options]
 * @param {boolean} [options.isOptional=false]
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, { isOptional = false } = {}) => {
  if (amount === null || amount === undefined || amount === '') {
    return isOptional ? '-' : '₹0.00';
  }

  let str;
  if (typeof amount === 'number') {
    if (isNaN(amount) || !isFinite(amount)) return '[Invalid Amount]';
    str = amount.toFixed(2);
  } else {
    str = String(amount).trim();
  }

  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    return '[Invalid Amount]';
  }

  const [intPart, decPart = ''] = str.split('.');
  const paddedDec = (decPart + '00').slice(0, 2);
  const formattedInt = formatIndianIntegerString(intPart);

  return `₹${formattedInt}.${paddedDec}`;
};

/**
 * Formats an ISO date string into a localized readable date.
 * Example: '2026-09-21T00:00:00Z' -> '21 Sep 2026'
 * @param {string} dateString
 * @returns {string} Formatted date
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

/**
 * Converts a numeric amount into words in the Indian numbering system.
 * Example: 5500 -> "Five Thousand Five Hundred Rupees Only"
 * @param {number|string} num
 * @returns {string}
 */
export const numberToIndianWords = (num) => {
  if (num === null || num === undefined || num === '') return '';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n) || n === 0) return 'Zero Rupees Only';

  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertTwoDigits = (val) => {
    if (val < 10) return single[val];
    if (val < 20) return double[val - 10];
    return tens[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + single[val % 10] : '');
  };

  const convertThreeDigits = (val) => {
    let str = '';
    if (val >= 100) {
      str += single[Math.floor(val / 100)] + ' Hundred';
      val %= 100;
      if (val > 0) str += ' ';
    }
    if (val > 0) {
      str += convertTwoDigits(val);
    }
    return str.trim();
  };

  const rupees = Math.floor(Math.abs(n));
  const paise = Math.round((Math.abs(n) - rupees) * 100);

  const crore = Math.floor(rupees / 10000000);
  const remCrore = rupees % 10000000;
  const lakh = Math.floor(remCrore / 100000);
  const remLakh = remCrore % 100000;
  const thousand = Math.floor(remLakh / 1000);
  const remThousand = remLakh % 1000;

  const words = [];
  if (crore > 0) words.push(convertThreeDigits(crore) + ' Crore');
  if (lakh > 0) words.push(convertTwoDigits(lakh) + ' Lakh');
  if (thousand > 0) words.push(convertTwoDigits(thousand) + ' Thousand');
  if (remThousand > 0) words.push(convertThreeDigits(remThousand));

  let result = (words.length > 0 ? words.join(' ') : 'Zero') + ' Rupees';
  if (paise > 0) {
    result += ' and ' + convertTwoDigits(paise) + ' Paise';
  }
  result += ' Only';
  return (n < 0 ? 'Minus ' : '') + result;
};

/**
 * Returns today's date formatted as 'YYYY-MM-DD' in the user's local timezone.
 * Avoids the UTC-offset bug where new Date().toISOString() returns yesterday's date
 * between 00:00 and 05:30 in timezones like IST (+05:30).
 * @returns {string} 'YYYY-MM-DD'
 */
export const getTodayLocalDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Converts a date input string ('YYYY-MM-DD') into an ISO datetime string.
 * If the selected date is today, preserves the current local time so timestamps
 * don't get reset to 00:00:00 UTC (05:30 am IST).
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {string} ISO-8601 string
 */
export const toLocalIsoDateTime = (dateStr) => {
  if (!dateStr) return new Date().toISOString();
  const now = new Date();
  const todayStr = getTodayLocalDate();
  if (dateStr === todayStr) {
    return now.toISOString();
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
  return dateObj.toISOString();
};
