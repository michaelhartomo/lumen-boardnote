import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { signal } from '@preact/signals-react';
import firebaseConfig from '../../../../firebase-applet-config.json';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

// Initialize Firebase App safely (reuse if already initialized)
const existing_apps = getApps();
const firebase_app =
  existing_apps.length > 0 ? existing_apps[0] : initializeApp(firebaseConfig);
export const google_calendar_auth = getAuth(firebase_app);

// Configure GoogleAuthProvider with Calendar Events scope
const google_provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => google_provider.addScope(scope));

// Cache OAuth access token strictly in memory (never in localStorage or sessionStorage)
let cached_access_token = null;

// Reactive signals for UI components
export const googleCalendarUserSignal = signal(null);
export const googleCalendarConnectedSignal = signal(false);
export const googleCalendarAuthLoadingSignal = signal(false);
export const googleCalendarAuthErrorSignal = signal('');

let auth_listener_initialized = false;

export function init_google_calendar_auth() {
  if (auth_listener_initialized) return;
  auth_listener_initialized = true;

  onAuthStateChanged(google_calendar_auth, (user) => {
    if (!user) {
      cached_access_token = null;
      googleCalendarUserSignal.value = null;
      googleCalendarConnectedSignal.value = false;
    } else {
      googleCalendarUserSignal.value = {
        uid: user.uid,
        display_name: user.displayName || user.email || 'Google User',
        email: user.email || '',
        photo_url: user.photoURL || '',
      };
      googleCalendarConnectedSignal.value = Boolean(cached_access_token);
    }
  });
}

// Automatically initialize listener on module load in browser
if (typeof window !== 'undefined') {
  init_google_calendar_auth();
}

export async function sign_in_google_calendar() {
  googleCalendarAuthLoadingSignal.value = true;
  googleCalendarAuthErrorSignal.value = '';
  try {
    const result = await signInWithPopup(google_calendar_auth, google_provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cached_access_token = credential?.accessToken ?? null;
    if (result.user) {
      googleCalendarUserSignal.value = {
        uid: result.user.uid,
        display_name: result.user.displayName || result.user.email || 'Google User',
        email: result.user.email || '',
        photo_url: result.user.photoURL || '',
      };
    }
    googleCalendarConnectedSignal.value = Boolean(cached_access_token);
    return {
      user: result.user,
      access_token: cached_access_token,
    };
  } catch (err) {
    const msg =
      err?.code === 'auth/popup-closed-by-user'
        ? 'Google sign-in popup was closed before completing.'
        : err?.message || 'Failed to sign in with Google Calendar.';
    googleCalendarAuthErrorSignal.value = msg;
    throw new Error(msg);
  } finally {
    googleCalendarAuthLoadingSignal.value = false;
  }
}

export async function get_google_calendar_token() {
  if (cached_access_token) return cached_access_token;
  if (!google_calendar_auth.currentUser) {
    const { access_token } = await sign_in_google_calendar();
    return access_token;
  }
  const result = await signInWithPopup(google_calendar_auth, google_provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  cached_access_token = credential?.accessToken ?? null;
  googleCalendarConnectedSignal.value = Boolean(cached_access_token);
  return cached_access_token;
}

export async function sign_out_google_calendar() {
  cached_access_token = null;
  googleCalendarConnectedSignal.value = false;
  googleCalendarUserSignal.value = null;
  await firebaseSignOut(google_calendar_auth);
}

// ============================================================================
// Time Range Formatting & Parsing Utilities (Format: DD-MM-YYYY HH:mm:ss)
// Example: 01-01-2027 00:00:00 to 01-01-2027 00:00:00
// ============================================================================

const pad2 = (n) => String(Math.max(0, Math.floor(Number(n) || 0))).padStart(2, '0');

export function format_date_to_lumen_time_str(date_input) {
  const d = date_input instanceof Date ? date_input : new Date(date_input);
  if (Number.isNaN(d.getTime())) return '';
  const day = pad2(d.getDate());
  const month = pad2(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  const seconds = pad2(d.getSeconds());
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

export function parse_lumen_time_str(raw_str) {
  if (!raw_str || typeof raw_str !== 'string') return null;
  const trimmed = raw_str.trim();
  if (!trimmed) return null;

  // Match DD-MM-YYYY HH:mm:ss or DD/MM/YYYY HH:mm(:ss)
  const dmy_match = trimmed.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (dmy_match) {
    const day = parseInt(dmy_match[1], 10);
    const month = parseInt(dmy_match[2], 10);
    const year = parseInt(dmy_match[3], 10);
    const hours = dmy_match[4] !== undefined ? parseInt(dmy_match[4], 10) : 0;
    const minutes = dmy_match[5] !== undefined ? parseInt(dmy_match[5], 10) : 0;
    const seconds = dmy_match[6] !== undefined ? parseInt(dmy_match[6], 10) : 0;

    if (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31 &&
      year >= 1970 &&
      year <= 2100 &&
      hours >= 0 &&
      hours <= 23 &&
      minutes >= 0 &&
      minutes <= 59 &&
      seconds >= 0 &&
      seconds <= 59
    ) {
      const dt = new Date(year, month - 1, day, hours, minutes, seconds, 0);
      if (
        dt.getFullYear() === year &&
        dt.getMonth() === month - 1 &&
        dt.getDate() === day
      ) {
        return dt;
      }
    }
  }

  // Match YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm(:ss)
  const ymd_match = trimmed.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (ymd_match) {
    const year = parseInt(ymd_match[1], 10);
    const month = parseInt(ymd_match[2], 10);
    const day = parseInt(ymd_match[3], 10);
    const hours = ymd_match[4] !== undefined ? parseInt(ymd_match[4], 10) : 0;
    const minutes = ymd_match[5] !== undefined ? parseInt(ymd_match[5], 10) : 0;
    const seconds = ymd_match[6] !== undefined ? parseInt(ymd_match[6], 10) : 0;
    const dt = new Date(year, month - 1, day, hours, minutes, seconds, 0);
    if (!Number.isNaN(dt.getTime())) {
      return dt;
    }
  }

  // Fallback native Date parse
  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return null;
}

export function normalize_lumen_time_str(raw_str) {
  const parsed = parse_lumen_time_str(raw_str);
  if (!parsed) return raw_str ? String(raw_str).trim() : '';
  return format_date_to_lumen_time_str(parsed);
}

// Convert DD-MM-YYYY HH:mm:ss -> YYYY-MM-DDTHH:mm:ss for <input type="datetime-local" step="1">
export function lumen_time_str_to_datetime_local(raw_str) {
  const dt = parse_lumen_time_str(raw_str);
  if (!dt) return '';
  const year = dt.getFullYear();
  const month = pad2(dt.getMonth() + 1);
  const day = pad2(dt.getDate());
  const hours = pad2(dt.getHours());
  const minutes = pad2(dt.getMinutes());
  const seconds = pad2(dt.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

// Convert YYYY-MM-DDTHH:mm(:ss) from <input type="datetime-local"> -> DD-MM-YYYY HH:mm:ss
export function datetime_local_to_lumen_time_str(local_val) {
  if (!local_val) return '';
  const dt = parse_lumen_time_str(local_val);
  if (!dt) return '';
  return format_date_to_lumen_time_str(dt);
}

// Generate quick preset time ranges in DD-MM-YYYY HH:mm:ss
export function create_time_range_preset(preset_id) {
  const now = new Date();
  now.setMilliseconds(0);

  if (preset_id === 'default_2027') {
    return {
      start: '01-01-2027 00:00:00',
      end: '01-01-2027 00:00:00',
    };
  }

  if (preset_id === 'now_1h') {
    const start = new Date(now);
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    return {
      start: format_date_to_lumen_time_str(start),
      end: format_date_to_lumen_time_str(end),
    };
  }

  if (preset_id === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
    return {
      start: format_date_to_lumen_time_str(start),
      end: format_date_to_lumen_time_str(end),
    };
  }

  if (preset_id === 'tomorrow') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 17, 0, 0);
    return {
      start: format_date_to_lumen_time_str(start),
      end: format_date_to_lumen_time_str(end),
    };
  }

  if (preset_id === 'next_7_days') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
    return {
      start: format_date_to_lumen_time_str(start),
      end: format_date_to_lumen_time_str(end),
    };
  }

  return {
    start: '01-01-2027 00:00:00',
    end: '01-01-2027 00:00:00',
  };
}

// Compute status and display metadata for a card's time range
export function get_card_time_range_status(card, reference_ms = Date.now()) {
  if (!card) {
    return { has_time_range: false, status: 'none' };
  }

  const raw_start = card.time_range_start ? String(card.time_range_start).trim() : '';
  const raw_end = card.time_range_end ? String(card.time_range_end).trim() : '';

  if (!raw_start && !raw_end) {
    return { has_time_range: false, status: 'none' };
  }

  const start_date = parse_lumen_time_str(raw_start) || parse_lumen_time_str(raw_end);
  const end_date = parse_lumen_time_str(raw_end) || start_date;

  const start_str = start_date ? format_date_to_lumen_time_str(start_date) : raw_start;
  const end_str = end_date ? format_date_to_lumen_time_str(end_date) : raw_end || start_str;

  if (!start_date) {
    return {
      has_time_range: true,
      start_str: raw_start || raw_end,
      end_str: raw_end || raw_start,
      start_date: null,
      end_date: null,
      status: 'scheduled',
      status_label: 'Scheduled',
      status_color: '#2563eb',
      status_bg: 'rgba(37, 99, 235, 0.1)',
      status_border: 'rgba(37, 99, 235, 0.28)',
      range_display: `${raw_start || '—'} to ${raw_end || raw_start || '—'}`,
    };
  }

  const start_ms = start_date.getTime();
  // If start and end are identical (e.g. 01-01-2027 00:00:00 to 01-01-2027 00:00:00),
  // treat the active window as lasting 1 hour (or full day if 00:00:00) for status comparison
  const effective_end_ms =
    end_date && end_date.getTime() > start_ms
      ? end_date.getTime()
      : start_date.getHours() === 0 && start_date.getMinutes() === 0 && start_date.getSeconds() === 0
      ? start_ms + 24 * 60 * 60 * 1000 - 1000
      : start_ms + 60 * 60 * 1000;

  let status = 'upcoming';
  let status_label = 'Upcoming';
  let status_color = '#2563eb';
  let status_bg = 'rgba(37, 99, 235, 0.1)';
  let status_border = 'rgba(37, 99, 235, 0.28)';

  if (reference_ms >= start_ms && reference_ms <= effective_end_ms) {
    status = 'active_now';
    status_label = 'Active Now';
    status_color = '#16a34a';
    status_bg = 'rgba(22, 163, 74, 0.12)';
    status_border = 'rgba(22, 163, 74, 0.3)';
  } else if (reference_ms > effective_end_ms) {
    status = 'overdue';
    status_label = 'Past / Due';
    status_color = '#dc2626';
    status_bg = 'rgba(220, 38, 38, 0.1)';
    status_border = 'rgba(220, 38, 38, 0.28)';
  } else if (start_ms - reference_ms <= 24 * 60 * 60 * 1000) {
    status = 'upcoming';
    status_label = 'Due Soon';
    status_color = '#d97706';
    status_bg = 'rgba(217, 119, 6, 0.12)';
    status_border = 'rgba(217, 119, 6, 0.3)';
  }

  return {
    has_time_range: true,
    start_str,
    end_str,
    start_date,
    end_date: end_date || start_date,
    start_ms,
    end_ms: effective_end_ms,
    status,
    status_label,
    status_color,
    status_bg,
    status_border,
    range_display: `${start_str} to ${end_str}`,
  };
}

// Check if a card matches an active board time range filter
export function does_card_match_time_filter(card, filter_config) {
  if (!filter_config || !filter_config.mode || filter_config.mode === 'all') {
    return true;
  }

  const mode = filter_config.mode;
  const info = get_card_time_range_status(card);

  if (mode === 'has_time') {
    return info.has_time_range;
  }

  if (mode === 'synced_gcal') {
    return Boolean(card?.calendar_event_id || card?.calendar_event_link);
  }

  if (!info.has_time_range || !info.start_date) {
    return false;
  }

  const now = new Date();
  const today_start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
  const today_end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  if (mode === 'active_now') {
    return info.status === 'active_now';
  }

  if (mode === 'today') {
    return info.start_ms <= today_end && info.end_ms >= today_start;
  }

  if (mode === 'upcoming') {
    return info.end_ms >= Date.now();
  }

  if (mode === 'overdue') {
    return info.status === 'overdue';
  }

  if (mode === 'custom') {
    const filter_start_dt = parse_lumen_time_str(filter_config.start);
    const filter_end_dt = parse_lumen_time_str(filter_config.end);
    const f_start = filter_start_dt ? filter_start_dt.getTime() : -Infinity;
    const f_end = filter_end_dt
      ? filter_end_dt.getTime() <= f_start
        ? f_start + 24 * 60 * 60 * 1000 - 1000
        : filter_end_dt.getTime()
      : Infinity;
    return info.start_ms <= f_end && info.end_ms >= f_start;
  }

  return true;
}

// Build Google Calendar Event payload from a Card
export function build_card_calendar_event_payload(card, override_range = {}) {
  const start_raw =
    override_range.start !== undefined ? override_range.start : card?.time_range_start;
  const end_raw =
    override_range.end !== undefined ? override_range.end : card?.time_range_end;

  const start_dt = parse_lumen_time_str(start_raw) || new Date('2027-01-01T00:00:00');
  let end_dt = parse_lumen_time_str(end_raw) || new Date(start_dt.getTime());

  // Google Calendar API requires end.dateTime >= start.dateTime.
  // If start and end are identical (e.g. 01-01-2027 00:00:00 to 01-01-2027 00:00:00),
  // set end 1 hour after start for the Calendar event block while noting exact time range in description.
  if (end_dt.getTime() <= start_dt.getTime()) {
    end_dt = new Date(start_dt.getTime() + 60 * 60 * 1000);
  }

  const time_zone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const title_str =
    (override_range.event_title && String(override_range.event_title).trim()) ||
    (card?.title && String(card.title).trim()) ||
    `Lumen ${(card?.type || 'Card').toUpperCase()} Event`;

  const desc_parts = [];
  desc_parts.push(
    `Lumen Card Time Range: ${format_date_to_lumen_time_str(start_dt)} to ${
      parse_lumen_time_str(end_raw)
        ? format_date_to_lumen_time_str(parse_lumen_time_str(end_raw))
        : format_date_to_lumen_time_str(start_dt)
    }`
  );
  if (card?.event_note) {
    desc_parts.push(`Event Note: ${card.event_note}`);
  }
  if (card?.content && typeof card.content === 'string') {
    const clean_content = card.content.replace(/<[^>]+>/g, ' ').trim();
    if (clean_content) {
      desc_parts.push(clean_content.slice(0, 1200));
    }
  } else if (card?.description && typeof card.description === 'string') {
    desc_parts.push(card.description.slice(0, 1200));
  }
  if (Array.isArray(card?.items) && card.items.length > 0) {
    const checklist_str = card.items
      .map((it) => `${it.done ? '[x]' : '[ ]'} ${it.text}`)
      .join('\n');
    desc_parts.push(`Checklist:\n${checklist_str}`);
  }
  if (card?.url) {
    desc_parts.push(`Link: ${card.url}`);
  }

  const location_str =
    card?.location_name && card?.address
      ? `${card.location_name}, ${card.address}`
      : card?.address || card?.location_name || '';

  return {
    summary: title_str,
    description: desc_parts.join('\n\n'),
    ...(location_str ? { location: location_str } : {}),
    start: {
      dateTime: start_dt.toISOString(),
      timeZone: time_zone,
    },
    end: {
      dateTime: end_dt.toISOString(),
      timeZone: time_zone,
    },
  };
}

// Create or Update Event on the user's primary Google Calendar
export async function sync_card_to_google_calendar(card, override_range = {}) {
  const token = await get_google_calendar_token();
  if (!token) {
    throw new Error('Google Calendar access token is required. Please sign in with Google.');
  }

  const event_payload = build_card_calendar_event_payload(card, override_range);
  const existing_event_id = card?.calendar_event_id
    ? String(card.calendar_event_id).trim()
    : '';

  const call_calendar_api = async (method, url) => {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event_payload),
    });
    return response;
  };

  let res = null;
  let action_performed = 'created';

  if (existing_event_id) {
    const patch_url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      existing_event_id
    )}`;
    res = await call_calendar_api('PATCH', patch_url);
    action_performed = 'updated';

    // If the event was deleted on Google Calendar (404 / 410), create a fresh event
    if (res.status === 404 || res.status === 410) {
      res = await call_calendar_api(
        'POST',
        'https://www.googleapis.com/calendar/v3/calendars/primary/events'
      );
      action_performed = 'created';
    }
  } else {
    res = await call_calendar_api(
      'POST',
      'https://www.googleapis.com/calendar/v3/calendars/primary/events'
    );
    action_performed = 'created';
  }

  if (res.status === 401 || res.status === 403) {
    cached_access_token = null;
    googleCalendarConnectedSignal.value = false;
    let err_detail = 'Google Calendar authorization expired or insufficient permissions.';
    try {
      const err_json = await res.json();
      if (err_json?.error?.message) err_detail = err_json.error.message;
    } catch (_) {}
    throw new Error(err_detail);
  }

  if (!res.ok) {
    let err_msg = `Google Calendar API error (${res.status})`;
    try {
      const err_json = await res.json();
      if (err_json?.error?.message) err_msg = err_json.error.message;
    } catch (_) {}
    throw new Error(err_msg);
  }

  const data = await res.json();
  return {
    event_id: data.id,
    html_link: data.htmlLink || 'https://calendar.google.com',
    summary: data.summary || event_payload.summary,
    synced_at: format_date_to_lumen_time_str(new Date()),
    action_performed,
  };
}
