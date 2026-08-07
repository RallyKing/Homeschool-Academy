/** Local calendar YYYY-MM-DD (avoids UTC shift from toISOString). */
export function localIsoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Sunday start of the local week containing `d`. */
export function localWeekStart(d: Date = new Date()): string {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - start.getDay());
  return localIsoDate(start);
}

export function localWeekRange(d: Date = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    weekStart: localIsoDate(start),
    weekEnd: localIsoDate(end),
    today: localIsoDate(d),
    dayOfWeek: d.getDay(),
  };
}
