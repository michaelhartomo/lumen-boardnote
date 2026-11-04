import { useState, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Calendar,
  Clock,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Filter,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import styles from './LUMEN_card_property_panel.module.css';
import {
  updateCard,
  saveCurrentBoardToStore,
  showToast,
  activeTimeRangeFilterSignal,
  setTimeRangeFilter,
  clearTimeRangeFilter,
  activeBoardSignal,
} from '../../signals/boardState.js';
import {
  googleCalendarUserSignal,
  googleCalendarConnectedSignal,
  googleCalendarAuthLoadingSignal,
  googleCalendarAuthErrorSignal,
  sign_in_google_calendar,
  sign_out_google_calendar,
  sync_card_to_google_calendar,
  normalize_lumen_time_str,
  parse_lumen_time_str,
  lumen_time_str_to_datetime_local,
  datetime_local_to_lumen_time_str,
  create_time_range_preset,
  get_card_time_range_status,
  does_card_match_time_filter,
} from '../../utils/googleCalendarSync.js';

function LUMEN_google_logo_svg() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function LUMEN_card_time_range_section({ selected_card }) {
  useSignals();

  const [start_input, set_start_input] = useState(selected_card?.time_range_start || '');
  const [end_input, set_end_input] = useState(selected_card?.time_range_end || '');
  const [is_confirming_gcal, set_is_confirming_gcal] = useState(false);
  const [is_syncing_gcal, set_is_syncing_gcal] = useState(false);
  const [gcal_error, set_gcal_error] = useState('');

  useEffect(() => {
    set_start_input(selected_card?.time_range_start || '');
    set_end_input(selected_card?.time_range_end || '');
    set_is_confirming_gcal(false);
    set_gcal_error('');
  }, [
    selected_card?.id,
    selected_card?.time_range_start,
    selected_card?.time_range_end,
  ]);

  if (!selected_card) return null;

  const time_status = get_card_time_range_status({
    ...selected_card,
    time_range_start: start_input,
    time_range_end: end_input,
  });

  const handle_commit_start = (raw_val) => {
    const trimmed = String(raw_val || '').trim();
    if (!trimmed) {
      set_start_input('');
      updateCard(selected_card.id, { time_range_start: '' }, true);
      saveCurrentBoardToStore();
      return;
    }
    const normalized = normalize_lumen_time_str(trimmed);
    set_start_input(normalized);
    const next_end = end_input ? normalize_lumen_time_str(end_input) : normalized;
    if (!end_input) {
      set_end_input(normalized);
    }
    updateCard(
      selected_card.id,
      {
        time_range_start: normalized,
        time_range_end: next_end,
      },
      true
    );
    saveCurrentBoardToStore();
  };

  const handle_commit_end = (raw_val) => {
    const trimmed = String(raw_val || '').trim();
    if (!trimmed) {
      set_end_input('');
      updateCard(selected_card.id, { time_range_end: '' }, true);
      saveCurrentBoardToStore();
      return;
    }
    const normalized = normalize_lumen_time_str(trimmed);
    set_end_input(normalized);
    const next_start = start_input ? normalize_lumen_time_str(start_input) : normalized;
    if (!start_input) {
      set_start_input(normalized);
    }
    updateCard(
      selected_card.id,
      {
        time_range_start: next_start,
        time_range_end: normalized,
      },
      true
    );
    saveCurrentBoardToStore();
  };

  const handle_apply_preset = (preset_id) => {
    if (preset_id === 'clear') {
      set_start_input('');
      set_end_input('');
      updateCard(
        selected_card.id,
        {
          time_range_start: '',
          time_range_end: '',
        },
        true
      );
      saveCurrentBoardToStore();
      showToast('Cleared card time range');
      return;
    }
    const range = create_time_range_preset(preset_id);
    set_start_input(range.start);
    set_end_input(range.end);
    updateCard(
      selected_card.id,
      {
        time_range_start: range.start,
        time_range_end: range.end,
      },
      true
    );
    saveCurrentBoardToStore();
    showToast(`Time range set: ${range.start} to ${range.end}`);
  };

  const handle_prepare_gcal_sync = () => {
    set_gcal_error('');
    // Ensure a valid time range is populated (defaulting to 01-01-2027 00:00:00 if empty)
    let eff_start = start_input.trim();
    let eff_end = end_input.trim();
    if (!eff_start && !eff_end) {
      eff_start = '01-01-2027 00:00:00';
      eff_end = '01-01-2027 00:00:00';
      set_start_input(eff_start);
      set_end_input(eff_end);
      updateCard(
        selected_card.id,
        {
          time_range_start: eff_start,
          time_range_end: eff_end,
        },
        true
      );
      saveCurrentBoardToStore();
    } else {
      eff_start = normalize_lumen_time_str(eff_start || eff_end);
      eff_end = normalize_lumen_time_str(eff_end || eff_start);
      set_start_input(eff_start);
      set_end_input(eff_end);
      updateCard(
        selected_card.id,
        {
          time_range_start: eff_start,
          time_range_end: eff_end,
        },
        true
      );
      saveCurrentBoardToStore();
    }

    if (!parse_lumen_time_str(eff_start) || !parse_lumen_time_str(eff_end)) {
      set_gcal_error('Please enter a valid date/time in format DD-MM-YYYY HH:mm:ss (e.g. 01-01-2027 00:00:00).');
      return;
    }

    // Open mandatory user confirmation dialog before mutating Google Calendar
    set_is_confirming_gcal(true);
  };

  const handle_confirm_sync_to_gcal = async () => {
    set_gcal_error('');
    set_is_syncing_gcal(true);
    try {
      const result = await sync_card_to_google_calendar(selected_card, {
        start: start_input || '01-01-2027 00:00:00',
        end: end_input || start_input || '01-01-2027 00:00:00',
      });
      updateCard(
        selected_card.id,
        {
          time_range_start: normalize_lumen_time_str(start_input || '01-01-2027 00:00:00'),
          time_range_end: normalize_lumen_time_str(end_input || start_input || '01-01-2027 00:00:00'),
          calendar_event_id: result.event_id,
          calendar_event_link: result.html_link,
          calendar_synced_at: result.synced_at,
        },
        true
      );
      saveCurrentBoardToStore();
      set_is_confirming_gcal(false);
      showToast(
        result.action_performed === 'updated'
          ? 'Updated event in Google Calendar!'
          : 'Added event to Google Calendar!'
      );
    } catch (err) {
      set_gcal_error(err?.message || 'Failed to sync with Google Calendar.');
    } finally {
      set_is_syncing_gcal(false);
    }
  };

  const gcal_user = googleCalendarUserSignal.value;
  const gcal_connected = googleCalendarConnectedSignal.value;
  const gcal_auth_loading = googleCalendarAuthLoadingSignal.value;
  const has_synced_event = Boolean(selected_card.calendar_event_id || selected_card.calendar_event_link);

  return (
    <div className={styles['lumen-property-time-section']}>
      {/* Section Header */}
      <div className={styles['lumen-property-time-header']}>
        <div className={styles['lumen-property-time-title']}>
          <Clock size={13} color="var(--lumen-accent, #2563eb)" />
          <span>Time Range / Event Due Date</span>
        </div>
        {time_status.has_time_range && (
          <span
            className={styles['lumen-property-time-status-badge']}
            style={{
              color: time_status.status_color,
              backgroundColor: time_status.status_bg,
              borderColor: time_status.status_border,
            }}
          >
            <span>{time_status.status_label}</span>
          </span>
        )}
      </div>

      {/* Start Date & Time Input */}
      <div className={styles['lumen-property-time-input-group']}>
        <div className={styles['lumen-property-time-label-row']}>
          <span>From (Start)</span>
          <span className={styles['lumen-property-time-format-hint']}>DD-MM-YYYY HH:mm:ss</span>
        </div>
        <div className={styles['lumen-property-time-dual-row']}>
          <input
            type="text"
            value={start_input}
            onChange={(e) => set_start_input(e.target.value)}
            onBlur={(e) => handle_commit_start(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            placeholder="01-01-2027 00:00:00"
            className={styles['lumen-property-time-text-input']}
            title="Start time in DD-MM-YYYY HH:mm:ss format (e.g. 01-01-2027 00:00:00)"
          />
          <label
            className={styles['lumen-property-time-picker-btn']}
            title="Pick start date & time from calendar"
          >
            <Calendar size={13} />
            <input
              type="datetime-local"
              step="1"
              value={lumen_time_str_to_datetime_local(start_input)}
              onChange={(e) => {
                const converted = datetime_local_to_lumen_time_str(e.target.value);
                if (converted) {
                  handle_commit_start(converted);
                }
              }}
              className={styles['lumen-property-time-native-input']}
            />
          </label>
        </div>
      </div>

      {/* End Date & Time Input */}
      <div className={styles['lumen-property-time-input-group']}>
        <div className={styles['lumen-property-time-label-row']}>
          <span>To (End / Due)</span>
          <span className={styles['lumen-property-time-format-hint']}>DD-MM-YYYY HH:mm:ss</span>
        </div>
        <div className={styles['lumen-property-time-dual-row']}>
          <input
            type="text"
            value={end_input}
            onChange={(e) => set_end_input(e.target.value)}
            onBlur={(e) => handle_commit_end(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            placeholder="01-01-2027 00:00:00"
            className={styles['lumen-property-time-text-input']}
            title="End time in DD-MM-YYYY HH:mm:ss format (e.g. 01-01-2027 00:00:00)"
          />
          <label
            className={styles['lumen-property-time-picker-btn']}
            title="Pick end date & time from calendar"
          >
            <Calendar size={13} />
            <input
              type="datetime-local"
              step="1"
              value={lumen_time_str_to_datetime_local(end_input)}
              onChange={(e) => {
                const converted = datetime_local_to_lumen_time_str(e.target.value);
                if (converted) {
                  handle_commit_end(converted);
                }
              }}
              className={styles['lumen-property-time-native-input']}
            />
          </label>
        </div>
      </div>

      {/* Quick Presets Row */}
      <div className={styles['lumen-property-time-presets-row']}>
        <button
          type="button"
          className={styles['lumen-property-time-preset-btn']}
          onClick={() => handle_apply_preset('default_2027')}
          title="Set 01-01-2027 00:00:00 to 01-01-2027 00:00:00"
        >
          01-01-2027
        </button>
        <button
          type="button"
          className={styles['lumen-property-time-preset-btn']}
          onClick={() => handle_apply_preset('now_1h')}
          title="Set current time + 1 hour"
        >
          Now (+1h)
        </button>
        <button
          type="button"
          className={styles['lumen-property-time-preset-btn']}
          onClick={() => handle_apply_preset('today')}
          title="Set Today 09:00:00 to 18:00:00"
        >
          Today
        </button>
        <button
          type="button"
          className={styles['lumen-property-time-preset-btn']}
          onClick={() => handle_apply_preset('tomorrow')}
          title="Set Tomorrow 09:00:00 to 17:00:00"
        >
          Tomorrow
        </button>
        <button
          type="button"
          className={styles['lumen-property-time-preset-btn']}
          onClick={() => handle_apply_preset('next_7_days')}
          title="Set Next 7 Days"
        >
          +7 Days
        </button>
        {(start_input || end_input) && (
          <button
            type="button"
            className={`${styles['lumen-property-time-preset-btn']} ${styles['lumen-property-time-preset-clear']}`}
            onClick={() => handle_apply_preset('clear')}
            title="Clear time range"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter Board by This Card's Time Range */}
      {time_status.has_time_range && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
            onClick={() => {
              const is_already_custom =
                activeTimeRangeFilterSignal.value?.mode === 'custom' &&
                activeTimeRangeFilterSignal.value?.start === time_status.start_str &&
                activeTimeRangeFilterSignal.value?.end === time_status.end_str;
              if (is_already_custom) {
                clearTimeRangeFilter();
                showToast('Cleared board time range filter');
              } else {
                setTimeRangeFilter({
                  mode: 'custom',
                  start: time_status.start_str,
                  end: time_status.end_str,
                });
                showToast(`Filtering board by ${time_status.start_str} → ${time_status.end_str}`);
              }
            }}
            style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '5px 8px' }}
            title="Filter all cards on the board that overlap with this card's time range"
          >
            <Filter size={12} />
            <span>
              {activeTimeRangeFilterSignal.value?.mode === 'custom' &&
              activeTimeRangeFilterSignal.value?.start === time_status.start_str &&
              activeTimeRangeFilterSignal.value?.end === time_status.end_str
                ? 'Clear Board Time Filter'
                : 'Filter Board by This Time Range'}
            </span>
          </button>
        </div>
      )}

      {/* Google Calendar Integration Box */}
      <div className={styles['lumen-property-gcal-box']}>
        <div className={styles['lumen-property-gcal-top']}>
          <div className={styles['lumen-property-gcal-brand']}>
            <LUMEN_google_logo_svg />
            <span>Google Calendar Sync</span>
          </div>
          {has_synced_event && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: '#15803d',
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                padding: '1px 6px',
                borderRadius: 4,
                border: '1px solid rgba(22, 163, 74, 0.25)',
              }}
            >
              Synced
            </span>
          )}
        </div>

        {/* Connected Google User Account Row */}
        {gcal_user && (
          <div className={styles['lumen-property-gcal-user-row']}>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 500,
              }}
              title={gcal_user.email || gcal_user.display_name}
            >
              {gcal_user.email || gcal_user.display_name}
            </span>
            <button
              type="button"
              onClick={async () => {
                await sign_out_google_calendar();
                showToast('Signed out of Google Calendar');
              }}
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--lumen-text-muted, #64748b)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 10,
                padding: '1px 4px',
              }}
              title="Disconnect Google account"
            >
              <LogOut size={11} />
              <span>Sign out</span>
            </button>
          </div>
        )}

        {/* Synced Event Status Banner & Link */}
        {has_synced_event && (
          <div className={styles['lumen-property-gcal-synced-banner']}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={12} />
              <span>
                {selected_card.calendar_synced_at
                  ? `Synced ${selected_card.calendar_synced_at}`
                  : 'Added to Google Calendar'}
              </span>
            </span>
            {selected_card.calendar_event_link && (
              <a
                href={selected_card.calendar_event_link}
                target="_blank"
                rel="noopener noreferrer"
                className={styles['lumen-property-gcal-open-link']}
              >
                <span>Open</span>
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        )}

        {/* Auth or Sync Error Message */}
        {(gcal_error || googleCalendarAuthErrorSignal.value) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 5,
              padding: '6px 8px',
              borderRadius: 5,
              backgroundColor: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              color: '#dc2626',
              fontSize: 10.5,
              lineHeight: 1.35,
            }}
          >
            <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{gcal_error || googleCalendarAuthErrorSignal.value}</span>
          </div>
        )}

        {/* Confirmation Dialog before mutating Google Calendar */}
        {is_confirming_gcal ? (
          <div className={styles['lumen-property-gcal-confirm-card']}>
            <div className={styles['lumen-property-gcal-confirm-title']}>
              <Calendar size={12} />
              <span>
                {has_synced_event
                  ? 'Confirm Update in Google Calendar'
                  : 'Confirm Add to Google Calendar'}
              </span>
            </div>
            <div className={styles['lumen-property-gcal-confirm-meta']}>
              <div>
                <strong>Event:</strong>{' '}
                {selected_card.title || `Lumen ${(selected_card.type || 'Card').toUpperCase()}`}
              </div>
              <div>
                <strong>From:</strong> {start_input || '01-01-2027 00:00:00'}
              </div>
              <div>
                <strong>To:</strong> {end_input || start_input || '01-01-2027 00:00:00'}
              </div>
              {(selected_card.location_name || selected_card.address) && (
                <div>
                  <strong>Location:</strong>{' '}
                  {selected_card.location_name || selected_card.address}
                </div>
              )}
            </div>
            <div className={styles['lumen-property-gcal-confirm-actions']}>
              <button
                type="button"
                disabled={is_syncing_gcal}
                onClick={handle_confirm_sync_to_gcal}
                className={styles['lumen-property-gcal-sync-btn']}
                style={{ flex: 1, padding: '6px 10px' }}
              >
                {is_syncing_gcal ? (
                  <>
                    <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <Check size={12} />
                    <span>{has_synced_event ? 'Confirm Update' : 'Confirm & Add'}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={is_syncing_gcal}
                onClick={() => set_is_confirming_gcal(false)}
                className={
                  styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary
                }
                style={{ padding: '6px 10px', fontSize: 11 }}
              >
                <X size={12} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {!gcal_connected && (
              <button
                type="button"
                disabled={gcal_auth_loading}
                onClick={async () => {
                  set_gcal_error('');
                  try {
                    await sign_in_google_calendar();
                    showToast('Connected to Google Calendar');
                  } catch (err) {
                    set_gcal_error(err?.message || 'Google sign-in failed');
                  }
                }}
                className={styles['lumen-property-gcal-signin-btn']}
              >
                <LUMEN_google_logo_svg />
                <span>
                  {gcal_auth_loading ? 'Signing in with Google...' : 'Sign in with Google'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handle_prepare_gcal_sync}
              className={styles['lumen-property-gcal-sync-btn']}
            >
              <Calendar size={13} />
              <span>
                {has_synced_event ? 'Update in Google Calendar' : 'Add to Google Calendar'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Batch Time Range Section for Multi-Card Selection (2+ Cards)
// ============================================================================
export function LUMEN_batch_time_range_section({ selected_ids = [] }) {
  useSignals();
  const [batch_start, set_batch_start] = useState('01-01-2027 00:00:00');
  const [batch_end, set_batch_end] = useState('01-01-2027 00:00:00');

  const handle_apply_batch_time = (start_val, end_val) => {
    const norm_start = normalize_lumen_time_str(start_val);
    const norm_end = normalize_lumen_time_str(end_val || start_val);
    set_batch_start(norm_start);
    set_batch_end(norm_end);
    selected_ids.forEach((id) => {
      updateCard(id, {
        time_range_start: norm_start,
        time_range_end: norm_end,
      });
    });
    saveCurrentBoardToStore();
    showToast(`Applied time range to ${selected_ids.length} cards`);
  };

  const handle_clear_batch_time = () => {
    selected_ids.forEach((id) => {
      updateCard(id, {
        time_range_start: '',
        time_range_end: '',
      });
    });
    saveCurrentBoardToStore();
    showToast(`Cleared time range on ${selected_ids.length} cards`);
  };

  return (
    <div className={styles['lumen-property-time-section']}>
      <div className={styles['lumen-property-time-header']}>
        <div className={styles['lumen-property-time-title']}>
          <Clock size={13} color="var(--lumen-accent, #2563eb)" />
          <span>Batch Time Range ({selected_ids.length} Cards)</span>
        </div>
      </div>

      <div className={styles['lumen-property-time-input-group']}>
        <div className={styles['lumen-property-time-label-row']}>
          <span>From (Start)</span>
          <span className={styles['lumen-property-time-format-hint']}>DD-MM-YYYY HH:mm:ss</span>
        </div>
        <div className={styles['lumen-property-time-dual-row']}>
          <input
            type="text"
            value={batch_start}
            onChange={(e) => set_batch_start(e.target.value)}
            placeholder="01-01-2027 00:00:00"
            className={styles['lumen-property-time-text-input']}
          />
          <label className={styles['lumen-property-time-picker-btn']} title="Pick start date & time">
            <Calendar size={13} />
            <input
              type="datetime-local"
              step="1"
              value={lumen_time_str_to_datetime_local(batch_start)}
              onChange={(e) => {
                const conv = datetime_local_to_lumen_time_str(e.target.value);
                if (conv) set_batch_start(conv);
              }}
              className={styles['lumen-property-time-native-input']}
            />
          </label>
        </div>
      </div>

      <div className={styles['lumen-property-time-input-group']}>
        <div className={styles['lumen-property-time-label-row']}>
          <span>To (End)</span>
          <span className={styles['lumen-property-time-format-hint']}>DD-MM-YYYY HH:mm:ss</span>
        </div>
        <div className={styles['lumen-property-time-dual-row']}>
          <input
            type="text"
            value={batch_end}
            onChange={(e) => set_batch_end(e.target.value)}
            placeholder="01-01-2027 00:00:00"
            className={styles['lumen-property-time-text-input']}
          />
          <label className={styles['lumen-property-time-picker-btn']} title="Pick end date & time">
            <Calendar size={13} />
            <input
              type="datetime-local"
              step="1"
              value={lumen_time_str_to_datetime_local(batch_end)}
              onChange={(e) => {
                const conv = datetime_local_to_lumen_time_str(e.target.value);
                if (conv) set_batch_end(conv);
              }}
              className={styles['lumen-property-time-native-input']}
            />
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={() => handle_apply_batch_time(batch_start, batch_end)}
          className={styles['lumen-property-gcal-sync-btn']}
          style={{ flex: 1, padding: '6px 10px' }}
        >
          <Check size={12} />
          <span>Apply to {selected_ids.length} Cards</span>
        </button>
        <button
          type="button"
          onClick={handle_clear_batch_time}
          className={`${styles['lumen-property-time-preset-btn']} ${styles['lumen-property-time-preset-clear']}`}
          style={{ padding: '6px 10px', fontSize: 11 }}
        >
          Clear All
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Board Time Range Filter Section (for Empty Selection Panel & Layer Panel)
// ============================================================================
export function LUMEN_board_time_filter_section() {
  useSignals();
  const filter_state = activeTimeRangeFilterSignal.value || {
    mode: 'all',
    start: '01-01-2027 00:00:00',
    end: '01-01-2027 00:00:00',
  };

  const cards = activeBoardSignal.value?.cards || [];
  const matching_count = cards.filter((c) => does_card_match_time_filter(c, filter_state)).length;

  const FILTER_MODES = [
    { id: 'all', label: 'All Cards' },
    { id: 'has_time', label: 'Scheduled' },
    { id: 'active_now', label: 'Active Now' },
    { id: 'today', label: 'Today' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'synced_gcal', label: 'Synced GCal' },
    { id: 'custom', label: 'Custom Range' },
  ];

  return (
    <div className={styles['lumen-property-time-section']}>
      <div className={styles['lumen-property-time-header']}>
        <div className={styles['lumen-property-time-title']}>
          <Filter size={13} color="var(--lumen-accent, #2563eb)" />
          <span>Filter Cards by Time Range</span>
        </div>
        {filter_state.mode !== 'all' && (
          <span
            className={styles['lumen-property-time-status-badge']}
            style={{
              color: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              borderColor: 'rgba(37, 99, 235, 0.25)',
            }}
          >
            {matching_count}/{cards.length} match
          </span>
        )}
      </div>

      <div className={styles['lumen-property-time-presets-row']}>
        {FILTER_MODES.map((m) => {
          const is_active = filter_state.mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setTimeRangeFilter({ mode: m.id })}
              className={styles['lumen-property-time-preset-btn']}
              style={
                is_active
                  ? {
                      borderColor: 'var(--lumen-accent, #2563eb)',
                      backgroundColor: 'rgba(37, 99, 235, 0.12)',
                      color: 'var(--lumen-accent, #2563eb)',
                      fontWeight: 700,
                    }
                  : undefined
              }
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {filter_state.mode === 'custom' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
          <div className={styles['lumen-property-time-input-group']}>
            <div className={styles['lumen-property-time-label-row']}>
              <span>Filter From</span>
              <span className={styles['lumen-property-time-format-hint']}>DD-MM-YYYY HH:mm:ss</span>
            </div>
            <div className={styles['lumen-property-time-dual-row']}>
              <input
                type="text"
                value={filter_state.start || ''}
                onChange={(e) => setTimeRangeFilter({ mode: 'custom', start: e.target.value })}
                onBlur={(e) =>
                  setTimeRangeFilter({
                    mode: 'custom',
                    start: normalize_lumen_time_str(e.target.value),
                  })
                }
                placeholder="01-01-2027 00:00:00"
                className={styles['lumen-property-time-text-input']}
              />
              <label className={styles['lumen-property-time-picker-btn']}>
                <Calendar size={13} />
                <input
                  type="datetime-local"
                  step="1"
                  value={lumen_time_str_to_datetime_local(filter_state.start)}
                  onChange={(e) => {
                    const conv = datetime_local_to_lumen_time_str(e.target.value);
                    if (conv) setTimeRangeFilter({ mode: 'custom', start: conv });
                  }}
                  className={styles['lumen-property-time-native-input']}
                />
              </label>
            </div>
          </div>

          <div className={styles['lumen-property-time-input-group']}>
            <div className={styles['lumen-property-time-label-row']}>
              <span>Filter To</span>
              <span className={styles['lumen-property-time-format-hint']}>DD-MM-YYYY HH:mm:ss</span>
            </div>
            <div className={styles['lumen-property-time-dual-row']}>
              <input
                type="text"
                value={filter_state.end || ''}
                onChange={(e) => setTimeRangeFilter({ mode: 'custom', end: e.target.value })}
                onBlur={(e) =>
                  setTimeRangeFilter({
                    mode: 'custom',
                    end: normalize_lumen_time_str(e.target.value),
                  })
                }
                placeholder="01-01-2027 00:00:00"
                className={styles['lumen-property-time-text-input']}
              />
              <label className={styles['lumen-property-time-picker-btn']}>
                <Calendar size={13} />
                <input
                  type="datetime-local"
                  step="1"
                  value={lumen_time_str_to_datetime_local(filter_state.end)}
                  onChange={(e) => {
                    const conv = datetime_local_to_lumen_time_str(e.target.value);
                    if (conv) setTimeRangeFilter({ mode: 'custom', end: conv });
                  }}
                  className={styles['lumen-property-time-native-input']}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LUMEN_card_time_range_section;
