const env = require('../config/env');

const getBounds = (startDateStr, endDateStr, timeZone = env.timezone) => {
  const getOffsetMs = (date, tz) => {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
    return tzDate.getTime() - utcDate.getTime();
  };

  const start = new Date(startDateStr + 'T00:00:00Z'); 
  const startOffsetMs = getOffsetMs(start, timeZone);
  const startBound = new Date(start.getTime() - startOffsetMs);

  const end = new Date(endDateStr + 'T00:00:00Z');
  end.setUTCDate(end.getUTCDate() + 1);
  const endOffsetMs = getOffsetMs(end, timeZone);
  const endBound = new Date(end.getTime() - endOffsetMs);

  return { startBound, endBound };
};

module.exports = {
  getBounds
};
