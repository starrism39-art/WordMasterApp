'use strict';
// Only a passive inline notice. Persist receipt before displaying; if storage
// fails, leave the normal status text visible without repeatedly notifying.
function takeReminder(model, wxApi) {
  const reminder = model && model.reminder;
  if (!reminder || !/^[a-f0-9]{64}$/.test(reminder.key) || typeof reminder.text !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(reminder.day)) return '';
  try {
    const storageKey = 'membership_reminder_receipts_v1';
    const previous = wxApi.getStorageSync(storageKey);
    const records = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
    if (records[reminder.key] === reminder.day) return '';
    const next = Object.fromEntries(Object.entries(records).filter(([,day]) => day === reminder.day));
    next[reminder.key] = reminder.day;
    wxApi.setStorageSync(storageKey, next);
    return reminder.text;
  } catch { return ''; }
}
module.exports = {takeReminder};
