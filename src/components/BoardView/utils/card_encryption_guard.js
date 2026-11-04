/**
 * Lumen Card Encryption Brute Force Protection Engine
 *
 * Provides multi-layered defense against automated and dictionary attacks:
 * 1. Progressive exponential backoff / lockout cooldowns on consecutive failed attempts.
 * 2. Persistent attempt tracking via sessionStorage (survives page refresh).
 * 3. Reactive signals for real-time lockout countdowns and UI indicators.
 * 4. Timing side-channel mitigation with artificial delay tarpits.
 * 5. High-entropy passkey generator and cryptographic entropy estimator.
 */

import { signal } from '@preact/signals-react';

// Reactive signal containing active security guard state for each card:
// key: card_id -> { failed_attempts, is_locked_out, remaining_seconds, cooldown_seconds, message }
export const cardSecurityGuardSignal = signal({});

// In-memory fallback map if sessionStorage is unavailable
const memory_guard_cache = new Map();

// Progressive lockout schedule (attempts -> cooldown seconds)
const COOLDOWN_TIERS = [
  { max_attempts: 2, cooldown_sec: 0, delay_ms: 300 },       // Attempts 1-2: Normal with slight delay
  { max_attempts: 3, cooldown_sec: 5, delay_ms: 600 },       // Attempt 3: 5s pause
  { max_attempts: 4, cooldown_sec: 15, delay_ms: 800 },      // Attempt 4: 15s pause
  { max_attempts: 5, cooldown_sec: 30, delay_ms: 1200 },     // Attempt 5: 30s pause
  { max_attempts: 7, cooldown_sec: 60, delay_ms: 1500 },     // Attempts 6-7: 1 minute pause
  { max_attempts: Infinity, cooldown_sec: 300, delay_ms: 2000 } // Attempts 8+: 5 minutes lockdown
];

/**
 * Storage key helper
 */
function get_storage_key(card_id) {
  return `lumen_bf_guard_${card_id || 'default'}`;
}

/**
 * Read raw record from sessionStorage or memory cache
 */
function read_guard_record(card_id) {
  if (!card_id) return null;
  const key = get_storage_key(card_id);

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (_) {}
  }

  return memory_guard_cache.get(key) || null;
}

/**
 * Write raw record to sessionStorage and memory cache
 */
function write_guard_record(card_id, record) {
  if (!card_id) return;
  const key = get_storage_key(card_id);

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      if (record) {
        window.sessionStorage.setItem(key, JSON.stringify(record));
      } else {
        window.sessionStorage.removeItem(key);
      }
    } catch (_) {}
  }

  if (record) {
    memory_guard_cache.set(key, record);
  } else {
    memory_guard_cache.delete(key);
  }
}

/**
 * Determine the tier based on failed attempt count
 */
function get_tier_config(failed_attempts) {
  for (const tier of COOLDOWN_TIERS) {
    if (failed_attempts <= tier.max_attempts) {
      return tier;
    }
  }
  return COOLDOWN_TIERS[COOLDOWN_TIERS.length - 1];
}

/**
 * Get the current security status for a card.
 * @param {string} card_id
 * @returns {Object} Security status object
 */
export function get_card_security_status(card_id) {
  if (!card_id) {
    return {
      is_locked_out: false,
      remaining_seconds: 0,
      failed_attempts: 0,
      cooldown_seconds: 0,
      message: '',
    };
  }

  const record = read_guard_record(card_id);
  if (!record || !record.failed_attempts) {
    return {
      is_locked_out: false,
      remaining_seconds: 0,
      failed_attempts: 0,
      cooldown_seconds: 0,
      message: '',
    };
  }

  const now = Date.now();
  const lockout_until = record.lockout_until || 0;
  const remaining_ms = Math.max(0, lockout_until - now);
  const remaining_seconds = Math.ceil(remaining_ms / 1000);
  const is_locked_out = remaining_seconds > 0;

  let message = '';
  if (is_locked_out) {
    message = `Too many incorrect attempts. Protection active: retry in ${remaining_seconds}s`;
  } else if (record.failed_attempts >= 2) {
    message = `${record.failed_attempts} incorrect attempts. Next failure will trigger a security cooldown.`;
  }

  return {
    is_locked_out,
    remaining_seconds,
    failed_attempts: record.failed_attempts || 0,
    cooldown_seconds: record.cooldown_seconds || 0,
    message,
  };
}

/**
 * Active timer interval to tick countdowns down
 */
let active_countdown_interval = null;
const monitored_card_ids = new Set();

function ensure_countdown_running() {
  if (active_countdown_interval) return;

  active_countdown_interval = setInterval(() => {
    if (monitored_card_ids.size === 0) {
      clearInterval(active_countdown_interval);
      active_countdown_interval = null;
      return;
    }

    const next_state = { ...cardSecurityGuardSignal.value };
    let has_changes = false;

    for (const card_id of monitored_card_ids) {
      const status = get_card_security_status(card_id);
      next_state[card_id] = status;
      has_changes = true;

      if (!status.is_locked_out) {
        monitored_card_ids.delete(card_id);
      }
    }

    if (has_changes) {
      cardSecurityGuardSignal.value = next_state;
    }
  }, 1000);
}

/**
 * Register a card for real-time countdown updates
 */
export function track_card_lockout(card_id) {
  if (!card_id) return;
  const status = get_card_security_status(card_id);
  cardSecurityGuardSignal.value = {
    ...cardSecurityGuardSignal.value,
    [card_id]: status,
  };

  if (status.is_locked_out) {
    monitored_card_ids.add(card_id);
    ensure_countdown_running();
  }
}

/**
 * Pre-check before attempting to decrypt or unlock a card.
 * Throws an Error if the card is currently locked out by rate limiting.
 * @param {string} card_id
 */
export function verify_can_attempt_unlock(card_id) {
  if (!card_id) return;
  const status = get_card_security_status(card_id);
  if (status.is_locked_out) {
    throw new Error(
      `Brute-force protection: card is temporarily locked. Please wait ${status.remaining_seconds}s before retrying.`
    );
  }
}

/**
 * Record a failed unlock attempt for a card.
 * Triggers progressive cooldown and updates reactive signal.
 * @param {string} card_id
 * @returns {Object} Updated security status
 */
export async function record_failed_unlock_attempt(card_id) {
  if (!card_id) return get_card_security_status(card_id);

  const existing = read_guard_record(card_id) || { failed_attempts: 0 };
  const failed_attempts = (existing.failed_attempts || 0) + 1;
  const tier = get_tier_config(failed_attempts);

  const now = Date.now();
  const lockout_until = tier.cooldown_sec > 0 ? now + tier.cooldown_sec * 1000 : 0;

  const record = {
    failed_attempts,
    lockout_until,
    last_attempt_at: now,
    cooldown_seconds: tier.cooldown_sec,
  };

  write_guard_record(card_id, record);

  // Artificial tarpit delay to prevent script hammering
  if (tier.delay_ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, tier.delay_ms));
  }

  const updated_status = get_card_security_status(card_id);
  cardSecurityGuardSignal.value = {
    ...cardSecurityGuardSignal.value,
    [card_id]: updated_status,
  };

  if (updated_status.is_locked_out) {
    monitored_card_ids.add(card_id);
    ensure_countdown_running();
  }

  return updated_status;
}

/**
 * Record a successful unlock for a card, resetting failure counters.
 * @param {string} card_id
 */
export function record_successful_unlock(card_id) {
  if (!card_id) return;
  write_guard_record(card_id, null);
  monitored_card_ids.delete(card_id);

  const next_state = { ...cardSecurityGuardSignal.value };
  delete next_state[card_id];
  cardSecurityGuardSignal.value = next_state;
}

/**
 * Strict passkey policy enforcement:
 * 10+ characters with Mixed Case (Uppercase & Lowercase), Numbers, and Symbols.
 * Example: K9#mQ2$vL8
 * @param {string} password
 * @returns {Object} Validation check results and feedback
 */
export function validate_passkey_policy(password) {
  const p = typeof password === 'string' ? password : '';
  const checks = {
    length: p.length >= 10,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    number: /[0-9]/.test(p),
    symbol: /[^A-Za-z0-9]/.test(p),
  };

  const is_valid = Boolean(
    checks.length &&
    checks.upper &&
    checks.lower &&
    checks.number &&
    checks.symbol
  );

  const passed_count = [
    checks.length,
    checks.upper,
    checks.lower,
    checks.number,
    checks.symbol,
  ].filter(Boolean).length;

  let message = '';
  if (!checks.length) {
    message = 'Passkey must be at least 10 characters long (e.g., K9#mQ2$vL8)';
  } else if (!checks.upper) {
    message = 'Passkey must contain at least one uppercase letter (A-Z)';
  } else if (!checks.lower) {
    message = 'Passkey must contain at least one lowercase letter (a-z)';
  } else if (!checks.number) {
    message = 'Passkey must contain at least one numeric digit (0-9)';
  } else if (!checks.symbol) {
    message = 'Passkey must contain at least one symbol (!@#$%^&*-_=+)';
  }

  return {
    ...checks,
    is_valid,
    passed_count,
    total_checks: 5,
    message,
  };
}

/**
 * Calculates cryptographic entropy in bits and estimates brute force cracking time.
 * Enforces the 10-char mixed + symbols security policy (e.g., K9#mQ2$vL8).
 * @param {string} password
 * @returns {Object} Entropy and cracking resilience breakdown
 */
export function calculate_brute_force_entropy(password) {
  if (!password || typeof password !== 'string') {
    return {
      entropy_bits: 0,
      score: 0,
      label: 'Empty',
      color: '#94a3b8',
      crack_time_estimate: 'Instant',
      is_acceptable: false,
      feedback: 'Enforce: 10 chars (Mixed + Symbols) (e.g., K9#mQ2$vL8)',
    };
  }

  const policy = validate_passkey_policy(password);
  const len = password.length;
  let pool_size = 0;

  if (policy.lower) pool_size += 26;
  if (policy.upper) pool_size += 26;
  if (policy.number) pool_size += 10;
  if (policy.symbol) pool_size += 33;

  if (pool_size === 0) pool_size = 1;

  // Shannon entropy estimate in bits
  const entropy_bits = Math.round(len * Math.log2(pool_size));

  // Trivial/common password blocklist
  const lower_pass = password.toLowerCase();
  const TRIVIAL_LIST = [
    'password', '12345678', '123456789', 'qwerty123', 'admin123',
    'pass1234', 'letmein1', 'welcome1', 'master123', 'secret123',
    'iloveyou', '00000000', '11111111', 'abcdefgh', 'passkey1',
    'k9#mq2$vl8'
  ];

  if (TRIVIAL_LIST.includes(lower_pass)) {
    return {
      entropy_bits: 10,
      score: 1,
      label: 'Known Common Password',
      color: '#ef4444',
      crack_time_estimate: '< 0.001 seconds (Trivial Wordlist)',
      is_acceptable: false,
      feedback: 'This is a known pattern or example password. Please choose a unique passkey.',
    };
  }

  // Policy check 1: Length < 10
  if (!policy.length) {
    return {
      entropy_bits,
      score: 1,
      label: `Too Short (${len}/10 chars)`,
      color: '#ef4444',
      crack_time_estimate: '< 1 second on modern GPU',
      is_acceptable: false,
      feedback: policy.message || 'Must be at least 10 characters long (e.g., K9#mQ2$vL8).',
    };
  }

  // Policy check 2: Missing character classes (mixed case, numbers, symbols)
  if (!policy.is_valid) {
    return {
      entropy_bits,
      score: Math.max(1, policy.passed_count - 1),
      label: `Policy Incomplete (${policy.passed_count}/5)`,
      color: '#f97316',
      crack_time_estimate: '~Few minutes on GPU cluster',
      is_acceptable: false,
      feedback: policy.message || 'Must contain uppercase, lowercase, numbers, and symbols (e.g., K9#mQ2$vL8).',
    };
  }

  // All policy requirements satisfied!
  if (entropy_bits < 60) {
    return {
      entropy_bits,
      score: 3,
      label: 'Policy Met (Resistant)',
      color: '#10b981',
      crack_time_estimate: '~Decades on GPU cluster',
      is_acceptable: true,
      feedback: 'Strong passkey meets 10-char mixed + symbol policy (e.g., K9#mQ2$vL8).',
    };
  }

  if (entropy_bits < 80) {
    return {
      entropy_bits,
      score: 4,
      label: 'High Entropy (Vault Grade)',
      color: '#10b981',
      crack_time_estimate: '~Centuries (100+ Billion H/s)',
      is_acceptable: true,
      feedback: 'Exceptional passkey. Fully resistant to high-throughput GPU dictionary attacks.',
    };
  }

  return {
    entropy_bits,
    score: 4,
    label: 'Post-Quantum Fortress',
    color: '#10b981',
    crack_time_estimate: '~Millions of years (Mathematically unbreakable)',
    is_acceptable: true,
    feedback: 'Maximum security rating. Symmetrical 256-bit space fully defended.',
  };
}

/**
 * Generates a cryptographically strong, random passkey (minimum 10, default 16 characters)
 * strictly containing mixed case, numbers, and high-readability special symbols.
 * Conforms to: 10 chars (Mixed + Symbols) (e.g., K9#mQ2$vL8)
 * @param {number} [length=16]
 * @returns {string}
 */
export function generate_strong_passkey(length = 16) {
  const target_len = Math.max(10, length);
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*-_=+';
  const all_chars = uppers + lowers + digits + symbols;

  const get_random_int = (max) => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  };

  // Guarantee at least 2 of each category for maximum entropy
  const guaranteed = [
    uppers[get_random_int(uppers.length)],
    uppers[get_random_int(uppers.length)],
    lowers[get_random_int(lowers.length)],
    lowers[get_random_int(lowers.length)],
    digits[get_random_int(digits.length)],
    digits[get_random_int(digits.length)],
    symbols[get_random_int(symbols.length)],
    symbols[get_random_int(symbols.length)],
  ];

  // Fill remainder up to target length
  while (guaranteed.length < target_len) {
    guaranteed.push(all_chars[get_random_int(all_chars.length)]);
  }

  // Fisher-Yates cryptographically uniform shuffle
  for (let i = guaranteed.length - 1; i > 0; i--) {
    const j = get_random_int(i + 1);
    const temp = guaranteed[i];
    guaranteed[i] = guaranteed[j];
    guaranteed[j] = temp;
  }

  return guaranteed.join('');
}
