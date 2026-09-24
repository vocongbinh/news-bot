export type DigestSlot = 'morning' | 'midday' | 'evening';

export function nowIso(timeZone = 'Asia/Ho_Chi_Minh'): string {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+07:00`;
}

export function detectDigestSlot(date = new Date(), timeZone = 'Asia/Ho_Chi_Minh'): DigestSlot {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(date),
  );
  if (hour < 10) return 'morning';
  if (hour < 16) return 'midday';
  return 'evening';
}

export function formatDigestHeading(date = new Date(), timeZone = 'Asia/Ho_Chi_Minh'): {
  slot: DigestSlot;
  emoji: string;
  label: string;
  when: string;
} {
  const slot = detectDigestSlot(date, timeZone);
  const emoji = slot === 'morning' ? '☀️' : slot === 'midday' ? '🌤' : '🌙';
  const label =
    slot === 'morning' ? 'Morning Digest' : slot === 'midday' ? 'Midday Digest' : 'Evening Digest';
  const when = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return { slot, emoji, label, when: `${when} ICT` };
}
