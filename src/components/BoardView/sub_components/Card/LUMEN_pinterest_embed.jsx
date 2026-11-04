import { useState, useEffect, useRef } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Loader2,
} from 'lucide-react';

import styles from './LUMEN_pinterest_embed.module.css';
import { updateCard, saveCurrentBoardToStore } from '../../signals/boardState.js';

export const DEFAULT_PINTEREST_PIN_URL = 'https://www.pinterest.com/pin/424605071093691246/';

/**
 * Generates an official Pinterest embed HTML snippet
 */
export function generate_pinterest_html_snippet(url = DEFAULT_PINTEREST_PIN_URL) {
  const pinUrl = url || DEFAULT_PINTEREST_PIN_URL;
  return `<a data-pin-do="embedPin" data-pin-width="large" data-pin-terse="true" href="${pinUrl}"></a>\n<script async defer src="https://assets.pinterest.com/js/pinit.js"></script>`;
}

/**
 * Extracts Pin ID and canonical URL for single Pinterest pin
 */
export function parse_pinterest_url(raw_url = '') {
  const clean = (raw_url || '').trim();
  if (!clean) {
    return {
      type: 'pin',
      id: '424605071093691246',
      canonical_url: DEFAULT_PINTEREST_PIN_URL,
    };
  }

  const pin_match = clean.match(/\/pin\/(\d+)/i);
  if (pin_match && pin_match[1]) {
    return {
      type: 'pin',
      id: pin_match[1],
      canonical_url: `https://www.pinterest.com/pin/${pin_match[1]}/`,
    };
  }

  return {
    type: 'pin',
    id: '',
    canonical_url: clean.startsWith('http') ? clean : `https://${clean}`,
  };
}

let pinterest_error_guard_installed = false;
function install_pinterest_error_guard() {
  if (typeof window === 'undefined' || pinterest_error_guard_installed) return;
  pinterest_error_guard_installed = true;
  window.addEventListener(
    'error',
    (event) => {
      const filename = String(event?.filename || '');
      const msg = String(event?.message || '');
      if (
        filename.includes('pinterest.com') ||
        filename.includes('pinit') ||
        (msg === 'Script error.' && !filename)
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );
}

/**
 * Ensures Pinterest's official pinit.js script is loaded with data-pin-build="doBuild"
 */
function ensure_pinterest_script(callback) {
  if (typeof window === 'undefined') return;
  install_pinterest_error_guard();

  if (typeof window.doBuild === 'function' || (window.PinUtils && typeof window.PinUtils.build === 'function')) {
    if (callback) callback();
    return;
  }

  let script = document.querySelector('script[src*="pinit.js"], script[src*="pinit_main.js"]');
  if (!script) {
    script = document.createElement('script');
    script.src = 'https://assets.pinterest.com/js/pinit.js';
    script.async = true;
    script.defer = true;
    script.onerror = () => {};
    script.setAttribute('data-pin-build', 'doBuild');
    document.body.appendChild(script);
  }

  let attempts = 0;
  const interval = setInterval(() => {
    attempts += 1;
    if (typeof window.doBuild === 'function' || (window.PinUtils && typeof window.PinUtils.build === 'function')) {
      clearInterval(interval);
      if (callback) callback();
    } else if (attempts > 30) {
      clearInterval(interval);
      if (callback) callback();
    }
  }, 100);
}

export default function LUMEN_pinterest_embed({ card }) {
  useSignals();
  const widget_slot_ref = useRef(null);

  const [pinterest_data, set_pinterest_data] = useState(null);
  const [is_loading_data, set_is_loading_data] = useState(false);
  const [widget_rendered, set_widget_rendered] = useState(false);

  const target_url = card.url || DEFAULT_PINTEREST_PIN_URL;
  const parsed_info = parse_pinterest_url(target_url);

  // 1. Fetch live Pinterest metadata for instant fallback if pinit.js is blocked
  useEffect(() => {
    let is_mounted = true;

    async function load_meta() {
      set_is_loading_data(true);

      let resolved = target_url;
      if (target_url.includes('pin.it')) {
        try {
          const res = await fetch('/api/embed/resolve-pinterest-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: target_url }),
          });
          const res_data = await res.json();
          if (res_data.resolved_url) {
            resolved = res_data.resolved_url;
          }
        } catch (e) {
          // ignore
        }
      }

      const info = parse_pinterest_url(resolved);

      try {
        if (info.id) {
          const res = await fetch(`/api/embed/pinterest-data?type=pin&id=${info.id}`);
          if (res.ok) {
            const json = await res.json();
            if (is_mounted && json.status === 'success') {
              set_pinterest_data(json.data);
            }
          }
        }
      } catch (err) {
        console.warn('Pinterest data fetch error:', err);
      } finally {
        if (is_mounted) set_is_loading_data(false);
      }
    }

    load_meta();

    return () => {
      is_mounted = false;
    };
  }, [target_url]);

  // 2. Official Pinterest Pin Widget Builder: Size L with 100% width, description removed (data-pin-terse="true")
  useEffect(() => {
    const slot = widget_slot_ref.current;
    if (!slot) return;

    slot.innerHTML = '';
    set_widget_rendered(false);

    // Official Pinterest embedPin anchor tag
    const anchor = document.createElement('a');
    anchor.href = parsed_info.canonical_url || target_url;
    anchor.setAttribute('data-pin-do', 'embedPin');
    anchor.setAttribute('data-pin-width', 'large'); // Pin widget size L
    anchor.setAttribute('data-pin-terse', 'true'); // Remove description display

    slot.appendChild(anchor);

    // Observe when pinit.js transforms the anchor into a Pinterest widget
    const observer = new MutationObserver(() => {
      if (
        slot.querySelector('span[data-pin-log], span.embed_pin, span.PIN_, iframe') ||
        (slot.firstElementChild && slot.firstElementChild.tagName !== 'A')
      ) {
        set_widget_rendered(true);
      }
    });

    observer.observe(slot, { childList: true, subtree: true });

    // Trigger Pinterest build
    ensure_pinterest_script(() => {
      try {
        if (typeof window.doBuild === 'function') {
          window.doBuild(slot);
        } else if (window.PinUtils && typeof window.PinUtils.build === 'function') {
          window.PinUtils.build(slot);
        }
      } catch (e) {
        console.warn('Pinterest widget build error:', e);
      }
    });

    return () => {
      observer.disconnect();
      if (slot) slot.innerHTML = '';
    };
  }, [target_url]);

  const pin_item = Array.isArray(pinterest_data) ? pinterest_data[0] : null;

  const display_image =
    pin_item?.images?.['564x']?.url ||
    pin_item?.images?.['236x']?.url ||
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80';

  return (
    <div className={styles['lumen-pinterest-container']}>
      {/* Main Pinterest Pin Widget Area — Width 100% */}
      <div className={styles['lumen-pinterest-widget-wrap']}>
        {/* Official Pin Widget Slot (Size L, 100% Width, Description Removed) */}
        <div
          ref={widget_slot_ref}
          className={styles['lumen-pinterest-slot']}
        />

        {/* Fallback View (displayed if script is loading or blocked by adblock) */}
        {!widget_rendered && (
          <div className={styles['lumen-pinterest-rich-pin']}>
            <div className={styles['lumen-pinterest-rich-image-wrap']}>
              <img
                src={display_image}
                alt="Pinterest Pin"
                data-pin-nopin="true"
                className={styles['lumen-pinterest-rich-img']}
              />
            </div>

            <div className={styles['lumen-pinterest-rich-details']}>
              <div className={styles['lumen-pinterest-rich-author-row']}>
                <div className={styles['lumen-pinterest-author-meta']}>
                  {pin_item?.pinner?.image_small_url && (
                    <img
                      src={pin_item.pinner.image_small_url}
                      alt={pin_item.pinner.full_name || 'Creator'}
                      className={styles['lumen-pinterest-avatar']}
                    />
                  )}
                  <span className={styles['lumen-pinterest-author-name']}>
                    {pin_item?.pinner?.full_name || 'Pinterest'}
                  </span>
                </div>

                {pin_item?.board?.name && (
                  <span className={styles['lumen-pinterest-board-badge']}>
                    {pin_item.board.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
