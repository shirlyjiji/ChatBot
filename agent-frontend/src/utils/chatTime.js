export const pad2 = (n) => String(n).padStart(2, '0');

export const getMsgTs = (m) => {
  // supports DB createdAt, socket ts, or fallback
  const ts = m?.createdAt || m?.ts || m?.time;
  const d = ts ? new Date(ts) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
};

export const formatTime = (dateObj) => {
  let h = dateObj.getHours();
  const m = pad2(dateObj.getMinutes());
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
};

export const formatDayLabel = (dateObj) => {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());

  const diff = Math.round((today - d) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';

  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
