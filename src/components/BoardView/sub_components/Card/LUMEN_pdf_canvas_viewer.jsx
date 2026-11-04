import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  AlertCircle,
  Download,
} from 'lucide-react';

import styles from './LUMEN_pdf_canvas_viewer.module.css';
import { pdfjsLib } from '../../utils/pdfRenderer.js';

function decode_base64_to_bytes(raw_input) {
  const clean_b64 = raw_input.includes(';base64,')
    ? raw_input.split(';base64,')[1]
    : raw_input.replace(/^data:[^,]+,/, '');
  const binary_str = atob(clean_b64.trim());
  const bytes = new Uint8Array(binary_str.length);
  for (let i = 0; i < binary_str.length; i++) {
    bytes[i] = binary_str.charCodeAt(i);
  }
  return bytes;
}

function LUMEN_pdf_page_canvas({
  pdf_doc,
  page_number,
  num_pages,
  is_active,
  container_width,
  zoom_multiplier,
  mode,
  is_fullscreen,
  default_page_size,
  scroll_root_ref,
  register_page_el,
}) {
  const wrapper_ref = useRef(null);
  const canvas_ref = useRef(null);
  const render_task_ref = useRef(null);
  const [is_near_viewport, set_is_near_viewport] = useState(page_number <= 3);
  const [page_dimensions, set_page_dimensions] = useState(null);

  useEffect(() => {
    register_page_el(page_number, wrapper_ref.current);
    return () => register_page_el(page_number, null);
  }, [page_number, register_page_el]);

  // Observe visibility with generous rootMargin so continuous scrolling pre-renders pages ahead
  useEffect(() => {
    const el = wrapper_ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      set_is_near_viewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            set_is_near_viewport(true);
          }
        }
      },
      {
        root: scroll_root_ref?.current || null,
        rootMargin: '1000px 0px 1000px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [scroll_root_ref]);

  const effective_mode = is_fullscreen ? 'modal' : mode;
  const fallback_w = default_page_size?.width || 612;
  const fallback_h = default_page_size?.height || 792;

  const measured_w = container_width || (effective_mode === 'modal' ? 900 : 320);
  const padding_offset = effective_mode === 'modal' ? 64 : 24;
  const fit_scale = (measured_w - padding_offset) / fallback_w;
  const base_scale =
    effective_mode === 'card'
      ? Math.min(1.5, Math.max(0.35, fit_scale))
      : Math.min(2.2, Math.max(0.75, fit_scale));
  const estimated_scale = Math.max(0.25, Math.min(4.0, base_scale * zoom_multiplier));

  const display_width = page_dimensions?.width || Math.floor(fallback_w * estimated_scale);
  const display_height = page_dimensions?.height || Math.floor(fallback_h * estimated_scale);

  useEffect(() => {
    if (!pdf_doc || !is_near_viewport || !canvas_ref.current) return;

    let is_cancelled = false;

    const render_single_page = async () => {
      try {
        if (render_task_ref.current) {
          try {
            render_task_ref.current.cancel();
          } catch (_) {}
        }

        const page = await pdf_doc.getPage(page_number);
        if (is_cancelled) return;

        const canvas = canvas_ref.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const unscaled_viewport = page.getViewport({ scale: 1 });
        const avail_width = container_width || (effective_mode === 'modal' ? 900 : 320);
        const pad = effective_mode === 'modal' ? 64 : 24;
        const page_fit_scale = (avail_width - pad) / unscaled_viewport.width;

        const page_base_scale =
          effective_mode === 'card'
            ? Math.min(1.5, Math.max(0.35, page_fit_scale))
            : Math.min(2.2, Math.max(0.75, page_fit_scale));

        const final_scale = Math.max(0.25, Math.min(4.0, page_base_scale * zoom_multiplier));
        const viewport = page.getViewport({ scale: final_scale });

        const w_px = Math.floor(viewport.width);
        const h_px = Math.floor(viewport.height);
        set_page_dimensions({ width: w_px, height: h_px });

        const pixel_ratio = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.floor(viewport.width * pixel_ratio);
        canvas.height = Math.floor(viewport.height * pixel_ratio);
        canvas.style.width = `${w_px}px`;
        canvas.style.height = `${h_px}px`;

        ctx.setTransform(pixel_ratio, 0, 0, pixel_ratio, 0, 0);

        const task = page.render({
          canvasContext: ctx,
          viewport,
        });
        render_task_ref.current = task;
        await task.promise;
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`[Lumen PDF Viewer] Page ${page_number} render error:`, err);
        }
      }
    };

    render_single_page();

    return () => {
      is_cancelled = true;
      if (render_task_ref.current) {
        try {
          render_task_ref.current.cancel();
        } catch (_) {}
      }
    };
  }, [pdf_doc, page_number, is_near_viewport, container_width, zoom_multiplier, effective_mode]);

  return (
    <div
      ref={wrapper_ref}
      data-page-number={page_number}
      className={`${styles['lumen-pdf-page-wrapper']} ${
        is_active ? styles['lumen-pdf-page-wrapper-active'] : ''
      }`}
      style={{
        width: `${display_width}px`,
        minHeight: `${display_height}px`,
      }}
    >
      <canvas ref={canvas_ref} className={styles['lumen-pdf-canvas']} />
      {num_pages > 1 && (
        <span className={styles['lumen-pdf-page-badge']}>
          {page_number} / {num_pages}
        </span>
      )}
    </div>
  );
}

export default function LUMEN_pdf_canvas_viewer({
  pdf_url,
  pdfUrl,
  pdf_data,
  pdfData,
  mode = 'card', // 'card' | 'modal'
  on_open_modal,
  onOpenModal,
  file_name,
  fileName,
  initial_page = 1,
  is_parent_fullscreen = false,
  is_seamless = false,
  on_toggle_parent_fullscreen,
  viewer_ref,
}) {
  const effective_url = pdf_url || pdfUrl || '';
  const effective_data = pdf_data || pdfData || '';
  const effective_open_modal = on_open_modal || onOpenModal;
  const effective_file_name = file_name || fileName || 'Document.pdf';

  const container_ref = useRef(null);
  const viewport_ref = useRef(null);
  const page_elements_ref = useRef({});
  const is_programmatic_scroll_ref = useRef(false);
  const programmatic_timer_ref = useRef(null);

  const [pdf_doc, set_pdf_doc] = useState(null);
  const [current_page, set_current_page] = useState(initial_page || 1);
  const [num_pages, set_num_pages] = useState(0);
  const [default_page_size, set_default_page_size] = useState({ width: 612, height: 792 });
  const [zoom_multiplier, set_zoom_multiplier] = useState(1.0);
  const [container_width, set_container_width] = useState(0);
  const [is_loading, set_is_loading] = useState(true);
  const [error_msg, set_error_msg] = useState(null);
  const [is_local_fullscreen, set_is_local_fullscreen] = useState(false);

  const is_fullscreen = Boolean(is_parent_fullscreen || is_local_fullscreen);

  const register_page_el = (page_num, el) => {
    if (el) {
      page_elements_ref.current[page_num] = el;
    } else {
      delete page_elements_ref.current[page_num];
    }
  };

  // Sync with native browser fullscreen change events
  useEffect(() => {
    const handle_fullscreen_change = () => {
      const fs_el = document.fullscreenElement || document.webkitFullscreenElement;
      if (fs_el === container_ref.current) {
        set_is_local_fullscreen(true);
      } else if (!fs_el && is_local_fullscreen) {
        set_is_local_fullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handle_fullscreen_change);
    document.addEventListener('webkitfullscreenchange', handle_fullscreen_change);
    return () => {
      document.removeEventListener('fullscreenchange', handle_fullscreen_change);
      document.removeEventListener('webkitfullscreenchange', handle_fullscreen_change);
    };
  }, [is_local_fullscreen]);

  // Observe container resize so card/modal/fullscreen resizing re-renders PDF crisply
  useEffect(() => {
    const el = viewport_ref.current || container_ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        if (w > 0) {
          set_container_width(w);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load PDF Document from base64 data or URL bytes
  useEffect(() => {
    let is_cancelled = false;
    set_is_loading(true);
    set_error_msg(null);

    if (!effective_url && !effective_data) {
      set_is_loading(false);
      set_error_msg('No PDF source provided');
      return;
    }

    const load_pdf = async () => {
      try {
        let pdf_bytes = null;

        if (effective_data && typeof effective_data === 'string') {
          pdf_bytes = decode_base64_to_bytes(effective_data);
        } else if (effective_url && effective_url.startsWith('data:')) {
          pdf_bytes = decode_base64_to_bytes(effective_url);
        } else if (effective_url) {
          const response = await fetch(effective_url, {
            credentials: 'same-origin',
          });
          if (!response.ok) {
            throw new Error(`Failed to fetch PDF (HTTP ${response.status})`);
          }
          const array_buffer = await response.arrayBuffer();
          pdf_bytes = new Uint8Array(array_buffer);
        }

        if (!pdf_bytes || pdf_bytes.byteLength === 0) {
          throw new Error('PDF file is empty');
        }

        const loading_task = pdfjsLib.getDocument({
          data: pdf_bytes,
        });

        const doc = await loading_task.promise;
        if (is_cancelled) return;

        // Measure first page default dimensions for smooth infinite scroll layout
        try {
          const first_page = await doc.getPage(1);
          const vp = first_page.getViewport({ scale: 1 });
          if (!is_cancelled && vp.width && vp.height) {
            set_default_page_size({ width: vp.width, height: vp.height });
          }
        } catch (_) {}

        if (!is_cancelled) {
          const total = doc.numPages || 1;
          const start_page = Math.min(total, Math.max(1, initial_page || 1));
          set_pdf_doc(doc);
          set_num_pages(total);
          set_current_page(start_page);
          set_is_loading(false);

          if (start_page > 1) {
            setTimeout(() => {
              scroll_to_page_element(start_page, false);
            }, 80);
          }
        }
      } catch (err) {
        if (!is_cancelled) {
          console.error('[Lumen PDF Viewer] Failed to load PDF:', err);
          set_error_msg(err?.message || 'Could not render PDF document');
          set_is_loading(false);
        }
      }
    };

    load_pdf();

    return () => {
      is_cancelled = true;
    };
  }, [effective_url, effective_data]);

  const scroll_to_page_element = (target_page, smooth = true) => {
    const viewport_el = viewport_ref.current;
    const page_el = page_elements_ref.current[target_page];
    if (!viewport_el || !page_el) return;

    is_programmatic_scroll_ref.current = true;
    if (programmatic_timer_ref.current) {
      clearTimeout(programmatic_timer_ref.current);
    }

    const top_offset = Math.max(0, page_el.offsetTop - 12);
    viewport_el.scrollTo({
      top: top_offset,
      behavior: smooth ? 'smooth' : 'auto',
    });

    programmatic_timer_ref.current = setTimeout(() => {
      is_programmatic_scroll_ref.current = false;
    }, 480);
  };

  const go_to_page = (target_page) => {
    if (!num_pages) return;
    const clamped = Math.min(num_pages, Math.max(1, target_page));
    set_current_page(clamped);
    scroll_to_page_element(clamped, true);
  };

  // Update active page indicator automatically during continuous infinite scroll
  const handle_viewport_scroll = () => {
    if (is_programmatic_scroll_ref.current) return;
    const viewport_el = viewport_ref.current;
    if (!viewport_el || num_pages <= 1) return;

    const probe_y = viewport_el.scrollTop + viewport_el.clientHeight * 0.35;
    let best_page = current_page;
    let min_distance = Infinity;

    for (let p = 1; p <= num_pages; p++) {
      const el = page_elements_ref.current[p];
      if (!el) continue;
      const page_top = el.offsetTop;
      const page_bottom = page_top + el.offsetHeight;

      if (probe_y >= page_top && probe_y <= page_bottom) {
        best_page = p;
        break;
      }

      const dist = Math.min(Math.abs(probe_y - page_top), Math.abs(probe_y - page_bottom));
      if (dist < min_distance) {
        min_distance = dist;
        best_page = p;
      }
    }

    if (best_page !== current_page) {
      set_current_page(best_page);
    }
  };

  const handle_prev_page = (e) => {
    if (e) e.stopPropagation();
    if (current_page > 1) {
      go_to_page(current_page - 1);
    }
  };

  const handle_next_page = (e) => {
    if (e) e.stopPropagation();
    if (current_page < num_pages) {
      go_to_page(current_page + 1);
    }
  };

  const handle_zoom_in = (e) => {
    if (e) e.stopPropagation();
    set_zoom_multiplier((z) => Math.min(3.0, Number((z + 0.2).toFixed(2))));
  };

  const handle_zoom_out = (e) => {
    if (e) e.stopPropagation();
    set_zoom_multiplier((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))));
  };

  const handle_reset_zoom = (e) => {
    if (e) e.stopPropagation();
    set_zoom_multiplier(1.0);
  };

  // Toggle True Full Screen directly
  const handle_toggle_fullscreen = async (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }

    if (on_toggle_parent_fullscreen) {
      on_toggle_parent_fullscreen();
      return;
    }

    const fs_el = document.fullscreenElement || document.webkitFullscreenElement;
    const currently_fs = Boolean(is_local_fullscreen || fs_el === container_ref.current);

    if (!currently_fs) {
      const el = container_ref.current;
      let entered_native_fs = false;
      if (el) {
        try {
          if (el.requestFullscreen) {
            await el.requestFullscreen();
            entered_native_fs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
          } else if (el.webkitRequestFullscreen) {
            await el.webkitRequestFullscreen();
            entered_native_fs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
          }
        } catch (_) {
          entered_native_fs = false;
        }
      }

      if (entered_native_fs) {
        set_is_local_fullscreen(true);
      } else if (mode === 'card' && effective_open_modal) {
        set_is_local_fullscreen(false);
        effective_open_modal(e, {
          is_fullscreen: true,
          initial_page: current_page,
        });
      } else {
        set_is_local_fullscreen(true);
      }
    } else {
      set_is_local_fullscreen(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
      } catch (_) {}
    }
  };

  useEffect(() => {
    if (viewer_ref && typeof viewer_ref === 'object') {
      viewer_ref.current = {
        enter_fullscreen: (e) => handle_toggle_fullscreen(e),
        get_current_page: () => current_page,
      };
    }
  }, [viewer_ref, is_local_fullscreen, current_page]);

  // Keep current page centered when entering or exiting fullscreen
  useEffect(() => {
    if (current_page > 1) {
      const timer = setTimeout(() => {
        scroll_to_page_element(current_page, false);
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [is_fullscreen]);

  // Keyboard arrow navigation for changing pages
  const handle_key_down = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (current_page > 1) {
        go_to_page(current_page - 1);
      }
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (current_page < num_pages) {
        go_to_page(current_page + 1);
      }
    } else if (e.key === 'Escape' && is_local_fullscreen) {
      e.preventDefault();
      e.stopPropagation();
      set_is_local_fullscreen(false);
    }
  };

  // Global keyboard arrow listener when in modal or fullscreen mode
  useEffect(() => {
    if (mode !== 'modal' && !is_fullscreen) return;

    const on_window_key = (e) => {
      const active_tag = document.activeElement?.tagName?.toLowerCase();
      if (active_tag === 'input' || active_tag === 'textarea') return;

      if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (current_page > 1) {
          go_to_page(current_page - 1);
        }
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (current_page < num_pages) {
          go_to_page(current_page + 1);
        }
      } else if (e.key === 'Escape' && on_toggle_parent_fullscreen) {
        e.preventDefault();
        on_toggle_parent_fullscreen();
      }
    };

    window.addEventListener('keydown', on_window_key);
    return () => window.removeEventListener('keydown', on_window_key);
  }, [mode, is_fullscreen, current_page, num_pages, on_toggle_parent_fullscreen]);

  const download_href = effective_url || effective_data || '';
  const page_numbers = Array.from({ length: num_pages }, (_, idx) => idx + 1);

  return (
    <div
      ref={container_ref}
      tabIndex={0}
      onKeyDown={handle_key_down}
      className={`${styles['lumen-pdf-viewer-container']} ${
        is_local_fullscreen
          ? styles['lumen-pdf-viewer-fullscreen']
          : mode === 'modal'
          ? styles['lumen-pdf-viewer-modal-mode']
          : styles['lumen-pdf-viewer-card-mode']
      }`}
      onMouseDown={(e) => {
        e.stopPropagation();
        container_ref.current?.focus({ preventScroll: true });
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Top Toolbar - Hidden in Seamless Card Mode */}
      {(mode === 'modal' || is_fullscreen || !is_seamless) && (
      <div className={styles['lumen-pdf-toolbar']}>
        {/* Page Arrow Navigation Group */}
        <div className={styles['lumen-pdf-nav-group']}>
          <button
            type="button"
            className={styles['lumen-pdf-tool-btn']}
            onClick={handle_prev_page}
            disabled={current_page <= 1}
            title="Previous Page (Left / Up Arrow)"
          >
            <ChevronLeft size={13} />
          </button>

          <span className={styles['lumen-pdf-page-indicator']} title="Current Page / Total Pages">
            Page {current_page} / {num_pages || 1}
          </span>

          <button
            type="button"
            className={styles['lumen-pdf-tool-btn']}
            onClick={handle_next_page}
            disabled={current_page >= num_pages}
            title="Next Page (Right / Down Arrow)"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className={styles['lumen-pdf-nav-group']}>
          <button
            type="button"
            className={styles['lumen-pdf-tool-btn']}
            onClick={handle_zoom_out}
            title="Zoom Out"
          >
            <ZoomOut size={12} />
          </button>
          <span className={styles['lumen-pdf-page-indicator']}>
            {Math.round(zoom_multiplier * 100)}%
          </span>
          <button
            type="button"
            className={styles['lumen-pdf-tool-btn']}
            onClick={handle_zoom_in}
            title="Zoom In"
          >
            <ZoomIn size={12} />
          </button>
          {zoom_multiplier !== 1.0 && (
            <button
              type="button"
              className={styles['lumen-pdf-tool-btn']}
              onClick={handle_reset_zoom}
              title="Reset Fit Zoom"
            >
              <RotateCcw size={11} />
            </button>
          )}
        </div>

        {/* True Full Screen Button */}
        <div className={styles['lumen-pdf-nav-group']}>
          <button
            type="button"
            className={styles['lumen-pdf-expand-btn']}
            onClick={handle_toggle_fullscreen}
            title={is_fullscreen ? 'Exit Full Screen' : 'Open True Full Screen Viewer'}
          >
            {is_fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            <span>{is_fullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
          </button>
        </div>
      </div>
      )}

      {/* Continuous Infinite Scroll Viewport with All PDF Pages */}
      <div
        ref={viewport_ref}
        onScroll={handle_viewport_scroll}
        className={
          mode === 'modal' || is_fullscreen
            ? styles['lumen-pdf-modal-viewport']
            : styles['lumen-pdf-viewport']
        }
      >
        {pdf_doc && !error_msg && (
          <div className={styles['lumen-pdf-pages-stack']}>
            {page_numbers.map((page_num) => (
              <LUMEN_pdf_page_canvas
                key={page_num}
                pdf_doc={pdf_doc}
                page_number={page_num}
                num_pages={num_pages}
                is_active={page_num === current_page}
                container_width={container_width}
                zoom_multiplier={zoom_multiplier}
                mode={mode}
                is_fullscreen={is_fullscreen}
                default_page_size={default_page_size}
                scroll_root_ref={viewport_ref}
                register_page_el={register_page_el}
              />
            ))}
          </div>
        )}

        {/* Loading Spinner */}
        {is_loading && (
          <div className={styles['lumen-pdf-loading']}>
            <Loader2 size={20} className={styles['lumen-pdf-spinner']} />
            <span>Loading PDF document...</span>
          </div>
        )}

        {/* Error Fallback */}
        {error_msg && !is_loading && (
          <div className={styles['lumen-pdf-error']}>
            <AlertCircle size={22} />
            <span>{error_msg}</span>
            {download_href && (
              <a
                href={download_href}
                download={effective_file_name}
                className={`${styles['lumen-pdf-tool-btn']} ${styles['lumen-pdf-download-link']}`}
              >
                <Download size={12} />
                <span>Download PDF directly</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Arrow Navigation Pill (for quick page jumping while scrolling) */}
      {(mode === 'modal' || is_fullscreen || !is_seamless) && !is_loading && !error_msg && num_pages > 1 && (
        <div className={styles['lumen-pdf-floating-nav']}>
          <button
            type="button"
            className={styles['lumen-pdf-tool-btn']}
            onClick={handle_prev_page}
            disabled={current_page <= 1}
            title="Previous Page (Arrow Left / Up)"
          >
            <ChevronLeft size={13} />
          </button>
          <span className={styles['lumen-pdf-page-indicator']}>
            {current_page} / {num_pages}
          </span>
          <button
            type="button"
            className={styles['lumen-pdf-tool-btn']}
            onClick={handle_next_page}
            disabled={current_page >= num_pages}
            title="Next Page (Arrow Right / Down)"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
