import { useState, useEffect, useRef } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Clock,
  Timer,
  Hourglass,
  Bell,
  BellRing,
  Calendar,
  Globe,
  Play,
  Pause,
  RotateCcw,
  Flag,
  Plus,
  Trash2,
  Sun,
  Moon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import styles from './LUMEN_clock_card.module.css';
import {
  updateCard,
  showToast,
  activeBoardSignal,
  resolve_card_font_family,
  resolve_card_style,
} from '../../signals/boardState.js';

export const COMPLETE_UTC_OFFSETS = [
  { value: 'LOCAL', label: 'Local System Time (Auto)', offset_minutes: null, region: 'Device Timezone' },
  { value: 'UTC-12:00', label: 'UTC-12:00 — Baker Island, Howland Island', offset_minutes: -720, region: 'Baker Island' },
  { value: 'UTC-11:00', label: 'UTC-11:00 — Pago Pago, Niue, Midway', offset_minutes: -660, region: 'American Samoa / Niue' },
  { value: 'UTC-10:00', label: 'UTC-10:00 — Honolulu, Papeete, Tahiti', offset_minutes: -600, region: 'Hawaii / Tahiti' },
  { value: 'UTC-09:30', label: 'UTC-09:30 — Marquesas Islands', offset_minutes: -570, region: 'Marquesas Islands' },
  { value: 'UTC-09:00', label: 'UTC-09:00 — Anchorage, Juneau, Gambier', offset_minutes: -540, region: 'Alaska' },
  { value: 'UTC-08:00', label: 'UTC-08:00 — Los Angeles, Vancouver, Tijuana', offset_minutes: -480, region: 'Pacific Time (PT)' },
  { value: 'UTC-07:00', label: 'UTC-07:00 — Denver, Phoenix, Calgary', offset_minutes: -420, region: 'Mountain Time (MT)' },
  { value: 'UTC-06:00', label: 'UTC-06:00 — Chicago, Mexico City, Winnipeg', offset_minutes: -360, region: 'Central Time (CT)' },
  { value: 'UTC-05:00', label: 'UTC-05:00 — New York, Toronto, Lima, Bogotá', offset_minutes: -300, region: 'Eastern Time (ET)' },
  { value: 'UTC-04:00', label: 'UTC-04:00 — Santiago, Caracas, Halifax, La Paz', offset_minutes: -240, region: 'Atlantic Time (AST)' },
  { value: 'UTC-03:30', label: 'UTC-03:30 — St. John’s (Newfoundland)', offset_minutes: -210, region: 'Newfoundland' },
  { value: 'UTC-03:00', label: 'UTC-03:00 — São Paulo, Buenos Aires, Montevideo', offset_minutes: -180, region: 'Brasília / Argentina' },
  { value: 'UTC-02:00', label: 'UTC-02:00 — Fernando de Noronha, South Georgia', offset_minutes: -120, region: 'Mid-Atlantic' },
  { value: 'UTC-01:00', label: 'UTC-01:00 — Azores, Cape Verde', offset_minutes: -60, region: 'Azores / Cape Verde' },
  { value: 'UTC+00:00', label: 'UTC+00:00 — London, Dublin, Lisbon, Accra, UTC', offset_minutes: 0, region: 'Greenwich Mean Time (UTC)' },
  { value: 'UTC+01:00', label: 'UTC+01:00 — Paris, Berlin, Madrid, Rome, Lagos', offset_minutes: 60, region: 'Central European Time' },
  { value: 'UTC+02:00', label: 'UTC+02:00 — Cairo, Athens, Johannesburg, Helsinki', offset_minutes: 120, region: 'Eastern European Time' },
  { value: 'UTC+03:00', label: 'UTC+03:00 — Moscow, Istanbul, Riyadh, Nairobi', offset_minutes: 180, region: 'Arabia / East Africa' },
  { value: 'UTC+03:30', label: 'UTC+03:30 — Tehran', offset_minutes: 210, region: 'Iran Standard Time' },
  { value: 'UTC+04:00', label: 'UTC+04:00 — Dubai, Baku, Tbilisi, Yerevan', offset_minutes: 240, region: 'Gulf Standard Time' },
  { value: 'UTC+04:30', label: 'UTC+04:30 — Kabul', offset_minutes: 270, region: 'Afghanistan Time' },
  { value: 'UTC+05:00', label: 'UTC+05:00 — Karachi, Tashkent, Yekaterinburg', offset_minutes: 300, region: 'Pakistan / West Asia' },
  { value: 'UTC+05:30', label: 'UTC+05:30 — Mumbai, New Delhi, Colombo', offset_minutes: 330, region: 'India Standard Time' },
  { value: 'UTC+05:45', label: 'UTC+05:45 — Kathmandu', offset_minutes: 345, region: 'Nepal Time' },
  { value: 'UTC+06:00', label: 'UTC+06:00 — Dhaka, Almaty, Bishkek, Thimphu', offset_minutes: 360, region: 'Bangladesh / Central Asia' },
  { value: 'UTC+06:30', label: 'UTC+06:30 — Yangon, Cocos Islands', offset_minutes: 390, region: 'Myanmar Time' },
  { value: 'UTC+07:00', label: 'UTC+07:00 — Jakarta, Bangkok, Ho Chi Minh City', offset_minutes: 420, region: 'Western Indonesia (WIB)' },
  { value: 'UTC+08:00', label: 'UTC+08:00 — Singapore, Beijing, Hong Kong, Perth, Makassar', offset_minutes: 480, region: 'ASEAN / China / WITA' },
  { value: 'UTC+08:45', label: 'UTC+08:45 — Eucla (Central Western Australia)', offset_minutes: 525, region: 'Central Western Australia' },
  { value: 'UTC+09:00', label: 'UTC+09:00 — Tokyo, Seoul, Jayapura', offset_minutes: 540, region: 'Japan / Korea / WIT' },
  { value: 'UTC+09:30', label: 'UTC+09:30 — Adelaide, Darwin', offset_minutes: 570, region: 'Australian Central Time' },
  { value: 'UTC+10:00', label: 'UTC+10:00 — Sydney, Melbourne, Brisbane, Port Moresby', offset_minutes: 600, region: 'Australian Eastern Time' },
  { value: 'UTC+10:30', label: 'UTC+10:30 — Lord Howe Island', offset_minutes: 630, region: 'Lord Howe Island' },
  { value: 'UTC+11:00', label: 'UTC+11:00 — Nouméa, Honiara, Port Vila', offset_minutes: 660, region: 'Solomon / New Caledonia' },
  { value: 'UTC+12:00', label: 'UTC+12:00 — Auckland, Suva, Wellington', offset_minutes: 720, region: 'New Zealand / Fiji' },
  { value: 'UTC+12:45', label: 'UTC+12:45 — Chatham Islands', offset_minutes: 765, region: 'Chatham Islands' },
  { value: 'UTC+13:00', label: 'UTC+13:00 — Apia, Nukuʻalofa, Fakaofo', offset_minutes: 780, region: 'Tonga / Samoa' },
  { value: 'UTC+14:00', label: 'UTC+14:00 — Kiritimati (Line Islands)', offset_minutes: 840, region: 'Line Islands' },
];

export const COUNTDOWN_PRESETS = [
  { label: '1m', seconds: 60 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
  { label: '10m', seconds: 600 },
  { label: '15m', seconds: 900 },
  { label: '25m', seconds: 1500 },
  { label: '30m', seconds: 1800 },
  { label: '1h', seconds: 3600 },
];

export const normalize_clock_data = (card) => {
  const raw = (card && card.clock_data && typeof card.clock_data === 'object') ? card.clock_data : {};
  const valid_modes = ['clock', 'stopwatch', 'countdown', 'alarm'];
  const mode = valid_modes.includes(raw.mode) ? raw.mode : 'clock';
  const utc_offset = COMPLETE_UTC_OFFSETS.some((item) => item.value === raw.utc_offset)
    ? raw.utc_offset
    : 'LOCAL';
  const show_date = raw.show_date !== undefined ? Boolean(raw.show_date) : true;
  const show_seconds = raw.show_seconds !== undefined ? Boolean(raw.show_seconds) : true;
  const use_24h = raw.use_24h !== undefined ? Boolean(raw.use_24h) : true;
  const show_analog = raw.show_analog !== undefined ? Boolean(raw.show_analog) : true;
  const theme = raw.theme === 'light' ? 'light' : 'dark';
  const sound_enabled = raw.sound_enabled !== undefined ? Boolean(raw.sound_enabled) : true;

  // Stopwatch state
  const stopwatch_running = Boolean(raw.stopwatch_running);
  const stopwatch_elapsed_ms = Number.isFinite(Number(raw.stopwatch_elapsed_ms))
    ? Math.max(0, Number(raw.stopwatch_elapsed_ms))
    : 0;
  const stopwatch_started_at = Number.isFinite(Number(raw.stopwatch_started_at)) && raw.stopwatch_started_at > 0
    ? Number(raw.stopwatch_started_at)
    : null;
  const stopwatch_laps = Array.isArray(raw.stopwatch_laps) ? raw.stopwatch_laps : [];

  // Countdown state
  const countdown_duration_sec = Number.isFinite(Number(raw.countdown_duration_sec)) && Number(raw.countdown_duration_sec) > 0
    ? Math.min(359999, Math.max(1, Math.round(Number(raw.countdown_duration_sec))))
    : 300;
  const countdown_remaining_ms = Number.isFinite(Number(raw.countdown_remaining_ms))
    ? Math.max(0, Number(raw.countdown_remaining_ms))
    : countdown_duration_sec * 1000;
  const countdown_running = Boolean(raw.countdown_running);
  const countdown_target_ts = Number.isFinite(Number(raw.countdown_target_ts)) && raw.countdown_target_ts > 0
    ? Number(raw.countdown_target_ts)
    : null;

  // Alarms state
  const alarms = Array.isArray(raw.alarms)
    ? raw.alarms.map((item, idx) => ({
        id: String(item?.id || `alarm_${idx + 1}`),
        time: typeof item?.time === 'string' && /^\d{2}:\d{2}$/.test(item.time) ? item.time : '09:00',
        label: typeof item?.label === 'string' && item.label.trim() ? item.label.trim() : 'Alarm',
        enabled: item?.enabled !== undefined ? Boolean(item.enabled) : true,
      }))
    : [
        { id: 'alarm_1', time: '09:00', label: 'Morning Standup', enabled: true },
      ];

  return {
    mode,
    utc_offset,
    show_date,
    show_seconds,
    use_24h,
    show_analog,
    theme,
    sound_enabled,
    stopwatch_running,
    stopwatch_elapsed_ms,
    stopwatch_started_at,
    stopwatch_laps,
    countdown_duration_sec,
    countdown_remaining_ms,
    countdown_running,
    countdown_target_ts,
    alarms,
  };
};

const play_chime_beeps = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [880, 1108.73, 1318.51, 1760];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.14);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.14 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.14);
      osc.stop(ctx.currentTime + idx * 0.14 + 0.26);
    });
    setTimeout(() => {
      if (ctx && typeof ctx.close === 'function') {
        ctx.close().catch(() => {});
      }
    }, 1500);
  } catch {
    // Ignore audio context block
  }
};

export const get_zoned_date_parts = (now_ms, utc_offset_code) => {
  const offset_entry = COMPLETE_UTC_OFFSETS.find((item) => item.value === utc_offset_code);
  const now_date = new Date(now_ms);

  if (!offset_entry || offset_entry.offset_minutes === null) {
    const local_offset_min = -now_date.getTimezoneOffset();
    const sign = local_offset_min >= 0 ? '+' : '-';
    const abs_min = Math.abs(local_offset_min);
    const pad_h = String(Math.floor(abs_min / 60)).padStart(2, '0');
    const pad_m = String(abs_min % 60).padStart(2, '0');
    return {
      year: now_date.getFullYear(),
      month: now_date.getMonth(),
      day: now_date.getDate(),
      weekday: now_date.getDay(),
      hours: now_date.getHours(),
      minutes: now_date.getMinutes(),
      seconds: now_date.getSeconds(),
      milliseconds: now_date.getMilliseconds(),
      offset_badge: `UTC${sign}${pad_h}:${pad_m} (Local)`,
      region_label: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Timezone',
    };
  }

  const shifted_ms = now_ms + offset_entry.offset_minutes * 60 * 1000;
  const shifted_date = new Date(shifted_ms);
  return {
    year: shifted_date.getUTCFullYear(),
    month: shifted_date.getUTCMonth(),
    day: shifted_date.getUTCDate(),
    weekday: shifted_date.getUTCDay(),
    hours: shifted_date.getUTCHours(),
    minutes: shifted_date.getUTCMinutes(),
    seconds: shifted_date.getUTCSeconds(),
    milliseconds: shifted_date.getUTCMilliseconds(),
    offset_badge: offset_entry.value,
    region_label: offset_entry.region,
  };
};

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const format_stopwatch_ms = (ms) => {
  const safe_ms = Math.max(0, Math.floor(ms));
  const total_seconds = Math.floor(safe_ms / 1000);
  const hours = Math.floor(total_seconds / 3600);
  const minutes = Math.floor((total_seconds % 3600) / 60);
  const seconds = total_seconds % 60;
  const centiseconds = Math.floor((safe_ms % 1000) / 10);

  const m_str = String(minutes).padStart(2, '0');
  const s_str = String(seconds).padStart(2, '0');
  const cs_str = String(centiseconds).padStart(2, '0');

  if (hours > 0) {
    return {
      main: `${String(hours).padStart(2, '0')}:${m_str}:${s_str}`,
      sub: `.${cs_str}`,
    };
  }
  return {
    main: `${m_str}:${s_str}`,
    sub: `.${cs_str}`,
  };
};

export const format_countdown_ms = (ms) => {
  const safe_ms = Math.max(0, Math.ceil(ms / 1000) * 1000);
  const total_seconds = Math.floor(safe_ms / 1000);
  const hours = Math.floor(total_seconds / 3600);
  const minutes = Math.floor((total_seconds % 3600) / 60);
  const seconds = total_seconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export function LUMEN_clock_card({ card }) {
  useSignals();

  const clock_data = normalize_clock_data(card);
  const is_seamless = resolve_card_style(card, activeBoardSignal.value) === 'seamless';
  const [now_ms, set_now_ms] = useState(() => Date.now());
  const [active_alert, set_active_alert] = useState(null);
  const [new_alarm_time, set_new_alarm_time] = useState('08:30');
  const [new_alarm_label, set_new_alarm_label] = useState('');
  const last_triggered_alarm_key_ref = useRef('');
  const clock_root_ref = useRef(null);
  const stage_ref = useRef(null);
  const [measured_size, set_measured_size] = useState(() => ({
    width: Number(card?.width) || 396,
    height: Number(card?.height) || 440,
  }));
  const [stage_size, set_stage_size] = useState(() => ({
    width: Math.max(220, (Number(card?.width) || 396) - (is_seamless ? 0 : 28)),
    height: Math.max(180, (Number(card?.height) || 440) - (is_seamless ? 0 : 165)),
  }));

  // Track live card and stage resizing via ResizeObserver
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        const h = Math.round(entry.contentRect.height);
        if (w <= 20 || h <= 20) continue;
        if (entry.target === clock_root_ref.current) {
          set_measured_size((prev) =>
            prev.width === w && prev.height === h ? prev : { width: w, height: h }
          );
        } else if (entry.target === stage_ref.current) {
          set_stage_size((prev) =>
            prev.width === w && prev.height === h ? prev : { width: w, height: h }
          );
        }
      }
    });
    if (clock_root_ref.current) ro.observe(clock_root_ref.current);
    if (stage_ref.current) ro.observe(stage_ref.current);
    return () => ro.disconnect();
  }, [clock_data.mode, is_seamless]);

  const effective_width = measured_size.width || Number(card?.width) || 396;
  const effective_height = measured_size.height || Number(card?.height) || 440;

  // Use measured stage dimensions (with fallback derived from card size)
  const fallback_w = is_seamless ? effective_width : effective_width - 28;
  const fallback_h = is_seamless ? effective_height : effective_height - 165;
  const inner_w = Math.max(
    150,
    (stage_size.width > 60 ? stage_size.width : fallback_w) - 20
  );
  const inner_h = Math.max(
    110,
    (stage_size.height > 60 ? stage_size.height : fallback_h) - 16
  );

  // Switch to side-by-side landscape layout when stage is wide and analog clock is visible
  const is_landscape_stage =
    clock_data.mode === 'clock' &&
    clock_data.show_analog &&
    inner_w > inner_h * 1.28 &&
    inner_w >= 420;

  // Date & timezone caption sizing
  const date_font_px = Math.round(
    Math.max(12, Math.min(38, Math.min(inner_w * 0.044, inner_h * 0.095)))
  );
  const tz_font_px = Math.round(Math.max(10, Math.min(28, date_font_px * 0.82)));
  const date_block_h =
    (clock_data.show_date ? date_font_px * 1.95 + 8 : 0) + tz_font_px * 1.5 + 8;

  // Horizontal character width divisor so digital time fills the available width without clipping
  const time_width_divisor =
    clock_data.mode === 'countdown'
      ? 4.75
      : clock_data.mode === 'stopwatch'
      ? 3.85
      : 2.75 + (clock_data.show_seconds ? 0.9 : 0) + (!clock_data.use_24h ? 0.68 : 0);

  let dial_size_px;
  let main_font_px;
  let large_main_font_px;

  if (is_landscape_stage) {
    // Side-by-side: Analog dial on left, Digital time + Date on right
    dial_size_px = Math.round(
      Math.max(96, Math.min(inner_h * 0.88, inner_w * 0.38))
    );
    const right_col_w = Math.max(140, inner_w - dial_size_px - 24);
    const right_avail_h = Math.max(60, inner_h - date_block_h - 8);
    main_font_px = Math.round(
      Math.max(
        34,
        Math.min(
          Math.floor(right_col_w / time_width_divisor),
          right_avail_h * 0.82
        )
      )
    );
    large_main_font_px = main_font_px;
  } else {
    // Stacked: Analog dial above Digital time + Date
    const clock_avail_h = Math.max(70, inner_h - date_block_h - 10);
    const max_time_px_by_width = Math.floor(inner_w / time_width_divisor);

    dial_size_px = Math.round(
      Math.max(90, Math.min(inner_w * 0.78, clock_avail_h * 0.54))
    );
    main_font_px = Math.round(
      Math.max(
        32,
        Math.min(
          max_time_px_by_width,
          (clock_avail_h - dial_size_px * 0.82) * 0.96
        )
      )
    );
    large_main_font_px = Math.round(
      Math.max(38, Math.min(max_time_px_by_width, clock_avail_h * 0.82))
    );
  }

  const active_main_px =
    clock_data.mode === 'clock' && clock_data.show_analog
      ? main_font_px
      : large_main_font_px;

  const sec_font_px = Math.round(Math.max(14, active_main_px * 0.5));
  const ampm_font_px = Math.round(Math.max(11, active_main_px * 0.3));

  const resolved_clock_font =
    resolve_card_font_family(card, activeBoardSignal.value) ||
    "var(--lumen-card-font, 'JetBrains Mono', 'Fira Code', monospace)";

  const save_clock_patch = (patch) => {
    const latest_clock_data = normalize_clock_data(card);
    updateCard(card.id, {
      clock_data: {
        ...latest_clock_data,
        ...patch,
      },
    });
  };

  // High-frequency tick when stopwatch or countdown is running, otherwise 250ms tick for accurate clock/alarm
  useEffect(() => {
    const interval_ms = (clock_data.stopwatch_running || clock_data.countdown_running) ? 45 : 250;
    const timer_id = setInterval(() => {
      set_now_ms(Date.now());
    }, interval_ms);
    return () => clearInterval(timer_id);
  }, [clock_data.stopwatch_running, clock_data.countdown_running]);

  // Check countdown completion
  useEffect(() => {
    if (!clock_data.countdown_running || !clock_data.countdown_target_ts) return;
    const remaining = clock_data.countdown_target_ts - now_ms;
    if (remaining <= 0) {
      save_clock_patch({
        countdown_running: false,
        countdown_target_ts: null,
        countdown_remaining_ms: 0,
      });
      set_active_alert({
        type: 'countdown',
        title: 'Countdown Finished!',
      });
      if (clock_data.sound_enabled) {
        play_chime_beeps();
      }
      showToast('Countdown timer completed!', 'info');
    }
  }, [now_ms, clock_data.countdown_running, clock_data.countdown_target_ts]);

  // Check alarms in selected UTC timezone
  const zoned_parts = get_zoned_date_parts(now_ms, clock_data.utc_offset);
  const current_hh_mm = `${String(zoned_parts.hours).padStart(2, '0')}:${String(zoned_parts.minutes).padStart(2, '0')}`;
  const current_date_minute_key = `${zoned_parts.year}-${zoned_parts.month}-${zoned_parts.day}_${current_hh_mm}`;

  useEffect(() => {
    if (zoned_parts.seconds > 2) return;
    if (last_triggered_alarm_key_ref.current === current_date_minute_key) return;

    const matching_alarm = clock_data.alarms.find(
      (alarm) => alarm.enabled && alarm.time === current_hh_mm
    );
    if (matching_alarm) {
      last_triggered_alarm_key_ref.current = current_date_minute_key;
      set_active_alert({
        type: 'alarm',
        alarm_id: matching_alarm.id,
        title: `${matching_alarm.label} (${matching_alarm.time})`,
      });
      if (clock_data.sound_enabled) {
        play_chime_beeps();
      }
      showToast(`Alarm: ${matching_alarm.label} (${matching_alarm.time})`, 'info');
    }
  }, [
    current_date_minute_key,
    current_hh_mm,
    zoned_parts.seconds,
    clock_data.alarms,
    clock_data.sound_enabled,
  ]);

  // Compute formatted clock display
  const raw_hours = zoned_parts.hours;
  const am_pm = raw_hours >= 12 ? 'PM' : 'AM';
  const display_hours = clock_data.use_24h
    ? String(raw_hours).padStart(2, '0')
    : String(raw_hours % 12 || 12).padStart(2, '0');
  const display_minutes = String(zoned_parts.minutes).padStart(2, '0');
  const display_seconds = String(zoned_parts.seconds).padStart(2, '0');
  const formatted_date_str = `${WEEKDAY_NAMES[zoned_parts.weekday]}, ${MONTH_NAMES[zoned_parts.month]} ${zoned_parts.day}, ${zoned_parts.year}`;

  // Analog hand angles
  const second_angle = (zoned_parts.seconds + zoned_parts.milliseconds / 1000) * 6;
  const minute_angle = (zoned_parts.minutes + zoned_parts.seconds / 60) * 6;
  const hour_angle = ((zoned_parts.hours % 12) + zoned_parts.minutes / 60) * 30;

  // Stopwatch calculation
  const current_stopwatch_ms = clock_data.stopwatch_running && clock_data.stopwatch_started_at
    ? clock_data.stopwatch_elapsed_ms + Math.max(0, now_ms - clock_data.stopwatch_started_at)
    : clock_data.stopwatch_elapsed_ms;
  const sw_formatted = format_stopwatch_ms(current_stopwatch_ms);

  const handle_stopwatch_toggle = (e) => {
    e.stopPropagation();
    if (clock_data.stopwatch_running) {
      const accumulated = clock_data.stopwatch_started_at
        ? clock_data.stopwatch_elapsed_ms + Math.max(0, Date.now() - clock_data.stopwatch_started_at)
        : clock_data.stopwatch_elapsed_ms;
      save_clock_patch({
        stopwatch_running: false,
        stopwatch_elapsed_ms: accumulated,
        stopwatch_started_at: null,
      });
    } else {
      save_clock_patch({
        stopwatch_running: true,
        stopwatch_started_at: Date.now(),
      });
    }
  };

  const handle_stopwatch_lap = (e) => {
    e.stopPropagation();
    if (!clock_data.stopwatch_running && current_stopwatch_ms <= 0) return;
    const prev_total = clock_data.stopwatch_laps.length > 0
      ? Number(clock_data.stopwatch_laps[0].total_ms || 0)
      : 0;
    const split_ms = Math.max(0, current_stopwatch_ms - prev_total);
    const next_lap = {
      id: `lap_${Date.now()}`,
      lap_number: clock_data.stopwatch_laps.length + 1,
      split_ms,
      total_ms: current_stopwatch_ms,
    };
    save_clock_patch({
      stopwatch_laps: [next_lap, ...clock_data.stopwatch_laps].slice(0, 50),
    });
  };

  const handle_stopwatch_reset = (e) => {
    e.stopPropagation();
    save_clock_patch({
      stopwatch_running: false,
      stopwatch_elapsed_ms: 0,
      stopwatch_started_at: null,
      stopwatch_laps: [],
    });
  };

  // Countdown calculation
  const current_countdown_ms = clock_data.countdown_running && clock_data.countdown_target_ts
    ? Math.max(0, clock_data.countdown_target_ts - now_ms)
    : clock_data.countdown_remaining_ms;
  const total_duration_ms = Math.max(1000, clock_data.countdown_duration_sec * 1000);
  const countdown_progress_pct = Math.min(
    100,
    Math.max(0, (current_countdown_ms / total_duration_ms) * 100)
  );

  const cd_hours_val = Math.floor(clock_data.countdown_duration_sec / 3600);
  const cd_minutes_val = Math.floor((clock_data.countdown_duration_sec % 3600) / 60);
  const cd_seconds_val = clock_data.countdown_duration_sec % 60;

  const update_countdown_hms = (next_h, next_m, next_s) => {
    const h = Math.max(0, Math.min(99, Number(next_h) || 0));
    const m = Math.max(0, Math.min(59, Number(next_m) || 0));
    const s = Math.max(0, Math.min(59, Number(next_s) || 0));
    const total_sec = Math.max(1, h * 3600 + m * 60 + s);
    save_clock_patch({
      countdown_duration_sec: total_sec,
      countdown_remaining_ms: total_sec * 1000,
      countdown_running: false,
      countdown_target_ts: null,
    });
  };

  const handle_countdown_toggle = (e) => {
    e.stopPropagation();
    if (clock_data.countdown_running) {
      const remaining = clock_data.countdown_target_ts
        ? Math.max(0, clock_data.countdown_target_ts - Date.now())
        : clock_data.countdown_remaining_ms;
      save_clock_patch({
        countdown_running: false,
        countdown_remaining_ms: remaining,
        countdown_target_ts: null,
      });
    } else {
      const base_ms = current_countdown_ms > 0
        ? current_countdown_ms
        : clock_data.countdown_duration_sec * 1000;
      save_clock_patch({
        countdown_running: true,
        countdown_remaining_ms: base_ms,
        countdown_target_ts: Date.now() + base_ms,
      });
      set_active_alert(null);
    }
  };

  const handle_countdown_reset = (e) => {
    e.stopPropagation();
    save_clock_patch({
      countdown_running: false,
      countdown_target_ts: null,
      countdown_remaining_ms: clock_data.countdown_duration_sec * 1000,
    });
    set_active_alert(null);
  };

  // Alarm handlers
  const handle_add_alarm = (e) => {
    e.stopPropagation();
    if (!/^\d{2}:\d{2}$/.test(new_alarm_time)) return;
    const next_alarm = {
      id: `alarm_${Date.now()}`,
      time: new_alarm_time,
      label: new_alarm_label.trim() || 'Alarm',
      enabled: true,
    };
    save_clock_patch({
      alarms: [...clock_data.alarms, next_alarm],
    });
    set_new_alarm_label('');
  };

  const handle_toggle_alarm = (alarm_id, e) => {
    e.stopPropagation();
    save_clock_patch({
      alarms: clock_data.alarms.map((item) =>
        item.id === alarm_id ? { ...item, enabled: !item.enabled } : item
      ),
    });
  };

  const handle_delete_alarm = (alarm_id, e) => {
    e.stopPropagation();
    save_clock_patch({
      alarms: clock_data.alarms.filter((item) => item.id !== alarm_id),
    });
  };

  const handle_snooze_alert = (e) => {
    e.stopPropagation();
    const snooze_date = new Date(now_ms + 5 * 60 * 1000);
    const snooze_parts = get_zoned_date_parts(snooze_date.getTime(), clock_data.utc_offset);
    const snooze_time = `${String(snooze_parts.hours).padStart(2, '0')}:${String(snooze_parts.minutes).padStart(2, '0')}`;
    const snooze_alarm = {
      id: `alarm_snooze_${Date.now()}`,
      time: snooze_time,
      label: 'Snoozed Alarm (+5m)',
      enabled: true,
    };
    save_clock_patch({
      alarms: [...clock_data.alarms, snooze_alarm],
    });
    set_active_alert(null);
    showToast(`Snoozed until ${snooze_time}`, 'info');
  };

  return (
    <div
      ref={clock_root_ref}
      className={`${styles['lumen-clock-card']} ${
        clock_data.theme === 'light' ? styles['lumen-clock-theme-light'] : ''
      }`}
      style={{
        '--lumen-card-font': resolved_clock_font,
        '--lumen-clock-main-size': `${main_font_px}px`,
        '--lumen-clock-main-large-size': `${large_main_font_px}px`,
        '--lumen-clock-sec-size': `${sec_font_px}px`,
        '--lumen-clock-ampm-size': `${ampm_font_px}px`,
        '--lumen-clock-dial-size': `${dial_size_px}px`,
        '--lumen-clock-date-size': `${date_font_px}px`,
        '--lumen-clock-tz-size': `${tz_font_px}px`,
        fontFamily: resolved_clock_font,
      }}
      onMouseDown={is_seamless ? undefined : (e) => e.stopPropagation()}
    >
      {/* Mode Navigation Header (Hidden in Seamless mode; accessible via Card Property Panel) */}
      {!is_seamless && (
        <div className={styles['lumen-clock-header']}>
          <div className={styles['lumen-clock-mode-tabs']}>
            <button
              type="button"
              className={`${styles['lumen-clock-mode-tab']} ${
                clock_data.mode === 'clock' ? styles['lumen-clock-mode-tab-active'] : ''
              }`}
              onClick={() => save_clock_patch({ mode: 'clock' })}
              title="Realtime World Clock"
            >
              <Clock size={12} />
              <span>Clock</span>
            </button>
            <button
              type="button"
              className={`${styles['lumen-clock-mode-tab']} ${
                clock_data.mode === 'stopwatch' ? styles['lumen-clock-mode-tab-active'] : ''
              }`}
              onClick={() => save_clock_patch({ mode: 'stopwatch' })}
              title="Stopwatch Mode"
            >
              <Timer size={12} />
              <span>Stopwatch</span>
            </button>
            <button
              type="button"
              className={`${styles['lumen-clock-mode-tab']} ${
                clock_data.mode === 'countdown' ? styles['lumen-clock-mode-tab-active'] : ''
              }`}
              onClick={() => save_clock_patch({ mode: 'countdown' })}
              title="Countdown Mode"
            >
              <Hourglass size={12} />
              <span>Countdown</span>
            </button>
            <button
              type="button"
              className={`${styles['lumen-clock-mode-tab']} ${
                clock_data.mode === 'alarm' ? styles['lumen-clock-mode-tab-active'] : ''
              }`}
              onClick={() => save_clock_patch({ mode: 'alarm' })}
              title="Alarm Mode"
            >
              <Bell size={12} />
              <span>Alarm</span>
            </button>
          </div>

          <div className={styles['lumen-clock-header-actions']}>
            <button
              type="button"
              className={`${styles['lumen-clock-icon-btn']} ${
                clock_data.sound_enabled ? styles['lumen-clock-icon-btn-active'] : ''
              }`}
              onClick={() => save_clock_patch({ sound_enabled: !clock_data.sound_enabled })}
              title={clock_data.sound_enabled ? 'Chime Sound On' : 'Chime Sound Muted'}
            >
              {clock_data.sound_enabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
            <button
              type="button"
              className={styles['lumen-clock-icon-btn']}
              onClick={() =>
                save_clock_patch({ theme: clock_data.theme === 'light' ? 'dark' : 'light' })
              }
              title="Toggle Light / Dark Clock Theme"
            >
              {clock_data.theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
            </button>
          </div>
        </div>
      )}

      {/* Ringing Alert Banner */}
      {active_alert && (
        <div
          className={styles['lumen-clock-alert-banner']}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className={styles['lumen-clock-alert-left']}>
            <BellRing size={14} />
            <span>{active_alert.title}</span>
          </div>
          <div className={styles['lumen-clock-alert-actions']}>
            {active_alert.type === 'alarm' && (
              <button
                type="button"
                className={styles['lumen-clock-alert-btn']}
                onClick={handle_snooze_alert}
              >
                Snooze +5m
              </button>
            )}
            <button
              type="button"
              className={styles['lumen-clock-alert-btn']}
              onClick={(e) => {
                e.stopPropagation();
                set_active_alert(null);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Card Body */}
      <div
        className={`${styles['lumen-clock-body']} ${
          is_seamless ? styles['lumen-clock-body-seamless'] : ''
        }`}
      >
        {/* Complete UTC Selector Bar (Hidden in Seamless mode; accessible via Card Property Panel) */}
        {!is_seamless && (clock_data.mode === 'clock' || clock_data.mode === 'alarm') && (
          <div className={styles['lumen-clock-utc-bar']}>
            <span className={styles['lumen-clock-utc-label']}>
              <Globe size={12} />
              <span>UTC Zone</span>
            </span>
            <select
              className={styles['lumen-clock-utc-select']}
              value={clock_data.utc_offset}
              onChange={(e) => save_clock_patch({ utc_offset: e.target.value })}
            >
              {COMPLETE_UTC_OFFSETS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* MODE 1: REALTIME CLOCK (or Seamless Alarm Mode Stage) */}
        {(clock_data.mode === 'clock' || (is_seamless && clock_data.mode === 'alarm')) && (
          <>
            <div
              ref={stage_ref}
              className={`${styles['lumen-clock-stage']} ${
                is_seamless ? styles['lumen-clock-stage-seamless'] : ''
              } ${is_landscape_stage ? styles['lumen-clock-stage-landscape'] : ''}`}
            >
              {clock_data.show_analog && (
                <div className={styles['lumen-clock-analog-wrap']}>
                  <svg
                    viewBox="0 0 120 120"
                    className={styles['lumen-clock-analog-svg']}
                    style={{ width: `${dial_size_px}px`, height: `${dial_size_px}px` }}
                    aria-label="Analog Clock"
                  >
                    <circle cx="60" cy="60" r="54" className={styles['lumen-clock-dial-ring']} />
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const angle_rad = ((idx * 30 - 90) * Math.PI) / 180;
                      const is_major = idx % 3 === 0;
                      const r_outer = 49;
                      const r_inner = is_major ? 41 : 44;
                      const x1 = 60 + Math.cos(angle_rad) * r_inner;
                      const y1 = 60 + Math.sin(angle_rad) * r_inner;
                      const x2 = 60 + Math.cos(angle_rad) * r_outer;
                      const y2 = 60 + Math.sin(angle_rad) * r_outer;
                      return (
                        <line
                          key={idx}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          className={`${styles['lumen-clock-dial-tick']} ${
                            is_major ? styles['lumen-clock-dial-tick-major'] : ''
                          }`}
                        />
                      );
                    })}
                    {/* Hour Hand */}
                    <line
                      x1="60"
                      y1="60"
                      x2={60 + Math.cos(((hour_angle - 90) * Math.PI) / 180) * 27}
                      y2={60 + Math.sin(((hour_angle - 90) * Math.PI) / 180) * 27}
                      className={styles['lumen-clock-hand-hour']}
                    />
                    {/* Minute Hand */}
                    <line
                      x1="60"
                      y1="60"
                      x2={60 + Math.cos(((minute_angle - 90) * Math.PI) / 180) * 38}
                      y2={60 + Math.sin(((minute_angle - 90) * Math.PI) / 180) * 38}
                      className={styles['lumen-clock-hand-minute']}
                    />
                    {/* Second Hand */}
                    {clock_data.show_seconds && (
                      <line
                        x1="60"
                        y1="60"
                        x2={60 + Math.cos(((second_angle - 90) * Math.PI) / 180) * 43}
                        y2={60 + Math.sin(((second_angle - 90) * Math.PI) / 180) * 43}
                        className={styles['lumen-clock-hand-second']}
                      />
                    )}
                    <circle cx="60" cy="60" r="3.5" className={styles['lumen-clock-center-dot']} />
                  </svg>
                </div>
              )}

              <div className={styles['lumen-clock-stage-main-col']}>
                <div
                  className={styles['lumen-clock-digital-row']}
                  style={{ fontFamily: resolved_clock_font }}
                >
                  <span
                    className={`${styles['lumen-clock-digital-main']} ${
                      !clock_data.show_analog ? styles['lumen-clock-digital-main-large'] : ''
                    }`}
                    style={{
                      fontSize: `${!clock_data.show_analog ? large_main_font_px : main_font_px}px`,
                      fontFamily: resolved_clock_font,
                    }}
                  >
                    {display_hours}:{display_minutes}
                  </span>
                  {clock_data.show_seconds && (
                    <span
                      className={styles['lumen-clock-digital-sec']}
                      style={{
                        fontSize: `${sec_font_px}px`,
                        fontFamily: resolved_clock_font,
                      }}
                    >
                      :{display_seconds}
                    </span>
                  )}
                  {!clock_data.use_24h && (
                    <span
                      className={styles['lumen-clock-digital-ampm']}
                      style={{
                        fontSize: `${ampm_font_px}px`,
                        fontFamily: resolved_clock_font,
                      }}
                    >
                      {am_pm}
                    </span>
                  )}
                </div>

                <div className={styles['lumen-clock-date-box']}>
                  {clock_data.show_date && (
                    <div
                      className={styles['lumen-clock-date-text']}
                      style={{
                        fontSize: `${date_font_px}px`,
                        fontFamily: resolved_clock_font,
                      }}
                    >
                      <Calendar size={Math.max(11, Math.round(date_font_px * 0.95))} />
                      <span>{formatted_date_str}</span>
                    </div>
                  )}
                  <div
                    className={styles['lumen-clock-tz-caption']}
                    style={{
                      fontSize: `${tz_font_px}px`,
                      fontFamily: resolved_clock_font,
                    }}
                  >
                    {clock_data.mode === 'alarm'
                      ? `${clock_data.alarms.filter((a) => a.enabled).length} Active Alarm(s) • ${zoned_parts.offset_badge}`
                      : `${zoned_parts.offset_badge} • ${zoned_parts.region_label}`}
                  </div>
                </div>
              </div>
            </div>

            {!is_seamless && (
              <div className={styles['lumen-clock-quick-toggles']}>
                <button
                  type="button"
                  className={`${styles['lumen-clock-pill-btn']} ${
                    clock_data.show_date ? styles['lumen-clock-pill-btn-active'] : ''
                  }`}
                  onClick={() => save_clock_patch({ show_date: !clock_data.show_date })}
                >
                  <Calendar size={11} />
                  <span>{clock_data.show_date ? 'Date On' : 'Date Off'}</span>
                </button>
                <button
                  type="button"
                  className={`${styles['lumen-clock-pill-btn']} ${
                    clock_data.use_24h ? styles['lumen-clock-pill-btn-active'] : ''
                  }`}
                  onClick={() => save_clock_patch({ use_24h: !clock_data.use_24h })}
                >
                  <span>{clock_data.use_24h ? '24H' : '12H'}</span>
                </button>
                <button
                  type="button"
                  className={`${styles['lumen-clock-pill-btn']} ${
                    clock_data.show_seconds ? styles['lumen-clock-pill-btn-active'] : ''
                  }`}
                  onClick={() => save_clock_patch({ show_seconds: !clock_data.show_seconds })}
                >
                  <span>Seconds</span>
                </button>
                <button
                  type="button"
                  className={`${styles['lumen-clock-pill-btn']} ${
                    clock_data.show_analog ? styles['lumen-clock-pill-btn-active'] : ''
                  }`}
                  onClick={() => save_clock_patch({ show_analog: !clock_data.show_analog })}
                >
                  <span>Analog Dial</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* MODE 2: STOPWATCH */}
        {clock_data.mode === 'stopwatch' && (
          <>
            <div
              ref={stage_ref}
              className={`${styles['lumen-clock-stage']} ${
                is_seamless ? styles['lumen-clock-stage-seamless'] : ''
              }`}
            >
              <div
                className={styles['lumen-clock-digital-row']}
                style={{ fontFamily: resolved_clock_font }}
              >
                <span
                  className={`${styles['lumen-clock-digital-main']} ${styles['lumen-clock-digital-main-large']}`}
                  style={{
                    fontSize: `${large_main_font_px}px`,
                    fontFamily: resolved_clock_font,
                  }}
                >
                  {sw_formatted.main}
                </span>
                <span
                  className={styles['lumen-clock-digital-sec']}
                  style={{
                    fontSize: `${sec_font_px}px`,
                    fontFamily: resolved_clock_font,
                  }}
                >
                  {sw_formatted.sub}
                </span>
              </div>
              <div
                className={styles['lumen-clock-tz-caption']}
                style={{
                  fontSize: `${tz_font_px}px`,
                  fontFamily: resolved_clock_font,
                }}
              >
                {clock_data.stopwatch_running ? 'Stopwatch Running' : 'Precision Stopwatch'}
              </div>
            </div>

            {!is_seamless && (
              <>
                <div className={styles['lumen-clock-controls-row']}>
                  <button
                    type="button"
                    className={`${styles['lumen-clock-ctrl-btn']} ${
                      clock_data.stopwatch_running
                        ? styles['lumen-clock-ctrl-warn']
                        : styles['lumen-clock-ctrl-primary']
                    }`}
                    onClick={handle_stopwatch_toggle}
                  >
                    {clock_data.stopwatch_running ? <Pause size={13} /> : <Play size={13} />}
                    <span>{clock_data.stopwatch_running ? 'Pause' : 'Start'}</span>
                  </button>
                  <button
                    type="button"
                    className={styles['lumen-clock-ctrl-btn']}
                    onClick={handle_stopwatch_lap}
                    disabled={!clock_data.stopwatch_running && current_stopwatch_ms <= 0}
                  >
                    <Flag size={13} />
                    <span>Lap</span>
                  </button>
                  <button
                    type="button"
                    className={styles['lumen-clock-ctrl-btn']}
                    onClick={handle_stopwatch_reset}
                    disabled={current_stopwatch_ms <= 0 && clock_data.stopwatch_laps.length === 0}
                  >
                    <RotateCcw size={13} />
                    <span>Reset</span>
                  </button>
                </div>

                {clock_data.stopwatch_laps.length > 0 && (
                  <div className={styles['lumen-clock-laps-list']}>
                    {clock_data.stopwatch_laps.map((lap) => {
                      const split_fmt = format_stopwatch_ms(lap.split_ms);
                      const total_fmt = format_stopwatch_ms(lap.total_ms);
                      return (
                        <div key={lap.id} className={styles['lumen-clock-lap-item']}>
                          <span className={styles['lumen-clock-lap-num']}>Lap #{lap.lap_number}</span>
                          <span className={styles['lumen-clock-lap-split']}>
                            +{split_fmt.main}
                            {split_fmt.sub}
                          </span>
                          <span className={styles['lumen-clock-lap-total']}>
                            {total_fmt.main}
                            {total_fmt.sub}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* MODE 3: COUNTDOWN */}
        {clock_data.mode === 'countdown' && (
          <>
            <div
              ref={stage_ref}
              className={`${styles['lumen-clock-stage']} ${
                is_seamless ? styles['lumen-clock-stage-seamless'] : ''
              }`}
            >
              <div
                className={styles['lumen-clock-digital-row']}
                style={{ fontFamily: resolved_clock_font }}
              >
                <span
                  className={`${styles['lumen-clock-digital-main']} ${styles['lumen-clock-digital-main-large']}`}
                  style={{
                    fontSize: `${large_main_font_px}px`,
                    fontFamily: resolved_clock_font,
                  }}
                >
                  {format_countdown_ms(current_countdown_ms)}
                </span>
              </div>
              <div className={styles['lumen-clock-progress-track']}>
                <div
                  className={styles['lumen-clock-progress-fill']}
                  style={{ width: `${countdown_progress_pct}%` }}
                />
              </div>
              <div
                className={styles['lumen-clock-tz-caption']}
                style={{
                  fontSize: `${tz_font_px}px`,
                  fontFamily: resolved_clock_font,
                }}
              >
                {clock_data.countdown_running
                  ? 'Countdown Active'
                  : `Target Duration: ${format_countdown_ms(clock_data.countdown_duration_sec * 1000)}`}
              </div>
            </div>

            {!is_seamless && (
              <>
                {!clock_data.countdown_running && (
                  <>
                    <div className={styles['lumen-clock-countdown-inputs']}>
                      <div className={styles['lumen-clock-time-field']}>
                        <span className={styles['lumen-clock-time-field-label']}>Hours</span>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          className={styles['lumen-clock-time-num-input']}
                          value={cd_hours_val}
                          onChange={(e) =>
                            update_countdown_hms(e.target.value, cd_minutes_val, cd_seconds_val)
                          }
                        />
                      </div>
                      <div className={styles['lumen-clock-time-field']}>
                        <span className={styles['lumen-clock-time-field-label']}>Min</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className={styles['lumen-clock-time-num-input']}
                          value={cd_minutes_val}
                          onChange={(e) =>
                            update_countdown_hms(cd_hours_val, e.target.value, cd_seconds_val)
                          }
                        />
                      </div>
                      <div className={styles['lumen-clock-time-field']}>
                        <span className={styles['lumen-clock-time-field-label']}>Sec</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className={styles['lumen-clock-time-num-input']}
                          value={cd_seconds_val}
                          onChange={(e) =>
                            update_countdown_hms(cd_hours_val, cd_minutes_val, e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className={styles['lumen-clock-preset-chips']}>
                      {COUNTDOWN_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          className={styles['lumen-clock-preset-chip']}
                          onClick={() =>
                            save_clock_patch({
                              countdown_duration_sec: preset.seconds,
                              countdown_remaining_ms: preset.seconds * 1000,
                              countdown_running: false,
                              countdown_target_ts: null,
                            })
                          }
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className={styles['lumen-clock-controls-row']}>
                  <button
                    type="button"
                    className={`${styles['lumen-clock-ctrl-btn']} ${
                      clock_data.countdown_running
                        ? styles['lumen-clock-ctrl-warn']
                        : styles['lumen-clock-ctrl-primary']
                    }`}
                    onClick={handle_countdown_toggle}
                  >
                    {clock_data.countdown_running ? <Pause size={13} /> : <Play size={13} />}
                    <span>{clock_data.countdown_running ? 'Pause' : 'Start'}</span>
                  </button>
                  <button
                    type="button"
                    className={styles['lumen-clock-ctrl-btn']}
                    onClick={handle_countdown_reset}
                  >
                    <RotateCcw size={13} />
                    <span>Reset</span>
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* MODE 4: ALARM (Full Mode Editor) */}
        {!is_seamless && clock_data.mode === 'alarm' && (
          <>
            <div className={styles['lumen-clock-alarm-add-row']}>
              <input
                type="time"
                className={styles['lumen-clock-alarm-time-input']}
                value={new_alarm_time}
                onChange={(e) => set_new_alarm_time(e.target.value)}
              />
              <input
                type="text"
                className={styles['lumen-clock-alarm-label-input']}
                placeholder="Alarm label (e.g. Standup)"
                value={new_alarm_label}
                onChange={(e) => set_new_alarm_label(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handle_add_alarm(e);
                }}
              />
              <button
                type="button"
                className={`${styles['lumen-clock-ctrl-btn']} ${styles['lumen-clock-ctrl-primary']}`}
                onClick={handle_add_alarm}
                title="Add Alarm"
              >
                <Plus size={13} />
                <span>Add</span>
              </button>
            </div>

            <div className={styles['lumen-clock-alarms-list']}>
              {clock_data.alarms.length === 0 ? (
                <div className={styles['lumen-clock-tz-caption']} style={{ textAlign: 'center', padding: '16px 0' }}>
                  No alarms configured. Add one above!
                </div>
              ) : (
                clock_data.alarms.map((alarm) => (
                  <div
                    key={alarm.id}
                    className={`${styles['lumen-clock-alarm-item']} ${
                      !alarm.enabled ? styles['lumen-clock-alarm-item-disabled'] : ''
                    }`}
                  >
                    <div className={styles['lumen-clock-alarm-info']}>
                      <span className={styles['lumen-clock-alarm-time']}>{alarm.time}</span>
                      <span className={styles['lumen-clock-alarm-title']}>{alarm.label}</span>
                    </div>
                    <div className={styles['lumen-clock-alarm-actions']}>
                      <button
                        type="button"
                        onClick={(e) => handle_toggle_alarm(alarm.id, e)}
                        className={`${styles['lumen-clock-alarm-toggle']} ${
                          alarm.enabled
                            ? styles['lumen-clock-alarm-toggle-on']
                            : styles['lumen-clock-alarm-toggle-off']
                        }`}
                      >
                        {alarm.enabled ? 'ON' : 'OFF'}
                      </button>
                      <button
                        type="button"
                        className={styles['lumen-clock-alarm-del-btn']}
                        onClick={(e) => handle_delete_alarm(alarm.id, e)}
                        title="Delete Alarm"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className={styles['lumen-clock-tz-caption']} style={{ textAlign: 'center' }}>
              Now in {zoned_parts.offset_badge}: <strong>{current_hh_mm}:{display_seconds}</strong>
              {clock_data.show_date ? ` • ${formatted_date_str}` : ''}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default LUMEN_clock_card;
