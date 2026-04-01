function parseISODate(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function addMinutes(date, m) {
  return new Date(date.getTime() + m * 60 * 1000);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function suggestSlots(body) {
  const durationMin = Number(body.durationMinutes ?? body.duration_minutes ?? 60);
  const windowStart = parseISODate(body.windowStart ?? body.time_window_start);
  const windowEnd = parseISODate(body.windowEnd ?? body.time_window_end);
  const bufferMin = Number(body.bufferMinutes ?? 10);
  const timezone = body.timezone ?? "Europe/Moscow";
  const maxResults = Math.min(Number(body.maxResults ?? 10), 50);

  const busyRaw = Array.isArray(body.busyIntervals) ? body.busyIntervals : [];
  const busy = busyRaw
    .map((b) => ({
      start: parseISODate(b.start),
      end: parseISODate(b.end),
    }))
    .filter((b) => b.start && b.end && b.start < b.end);

  if (!windowStart || !windowEnd || windowStart >= windowEnd) {
    return {
      slots: [],
      meta: {
        ok: false,
        message: "Некорректное окно поиска (windowStart/windowEnd)",
        timezone,
      },
    };
  }

  if (durationMin <= 0 || durationMin > 24 * 60) {
    return {
      slots: [],
      meta: { ok: false, message: "Некорректная длительность durationMinutes", timezone },
    };
  }

  const stepMin = 15;
  const slots = [];
  let cursor = new Date(windowStart);

  while (addMinutes(cursor, durationMin) <= windowEnd && slots.length < maxResults) {
    const slotStart = new Date(cursor);
    const slotEnd = addMinutes(slotStart, durationMin);
    const slotEndWithBuffer = addMinutes(slotEnd, bufferMin);

    let conflict = false;
    for (const b of busy) {
      if (overlaps(slotStart, slotEndWithBuffer, b.start, b.end)) {
        conflict = true;
        break;
      }
    }

    if (!conflict) {
      const score = 100 - Math.min(50, Math.floor((slotStart - windowStart) / (3600 * 1000)));
      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        score,
        reason: "Свободно с учётом буфера и занятости",
      });
    }

    cursor = addMinutes(cursor, stepMin);
  }

  slots.sort((a, b) => b.score - a.score);

  return {
    slots,
    meta: {
      ok: true,
      count: slots.length,
      timezone,
      message:
        slots.length === 0
          ? "Свободных слотов не найдено — расширьте окно или уменьшите длительность"
          : undefined,
    },
  };
}
