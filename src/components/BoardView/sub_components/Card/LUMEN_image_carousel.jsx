import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Link2,
  Plus,
  Trash2,
  Play,
  Pause,
  Image as ImageIcon,
  X,
  Maximize2,
  Scan,
  FileText,
  LayoutGrid,
  Sparkles,
  Download,
} from 'lucide-react';

import styles from './LUMEN_image_carousel.module.css';
import {
  activeBoardSignal,
  addCard,
  updateCard,
  snapToGridSignal,
  snapToGrid,
  pushHistorySnapshot,
  showToast,
  saveCurrentBoardToStore,
  openImageViewer,
  resolve_card_style,
  mark_card_interaction_start,
  mark_card_interaction_end,
} from '../../signals/boardState.js';
import {
  runAiCardAction,
  improveImagePromptWithMuse,
  isCardAiProcessingSignal,
  getSelectedAiModelForTask,
} from '../../signals/aiState.js';

// Normalizer: ensure card images are array of objects { id, url, caption }
export const normalize_card_slides = (card) => {
  if (Array.isArray(card.images) && card.images.length > 0) {
    return card.images.map((item, idx) => {
      if (typeof item === 'string') {
        return {
          id: `slide_${idx}`,
          url: item,
          caption: card.caption || '',
        };
      }
      return {
        ...item,
        id: item.id || `slide_${idx}`,
        url: item.url || '',
        caption: item.caption || '',
      };
    });
  }
  if (card.imageUrl) {
    return [
      {
        id: 'slide_0',
        url: card.imageUrl,
        caption: card.caption || '',
        ...(card.file_id ? { file_id: card.file_id } : {}),
        ...(card.output_format ? { output_format: card.output_format } : {}),
      },
    ];
  }
  return [];
};

export default function LUMEN_image_carousel({ card }) {
  useSignals();

  const file_input_ref = useRef(null);
  const container_ref = useRef(null);
  const top_bar_ref = useRef(null);
  const image_area_ref = useRef(null);
  const nav_bar_ref = useRef(null);
  const caption_textarea_ref = useRef(null);
  const note_box_ref = useRef(null);
  const note_text_ref = useRef(null);
  const note_resize_state_ref = useRef({
    is_pointer_down: false,
    start_note_h: 68,
    start_card_h: 460,
    last_note_h: 68,
  });
  const autoplay_timer_ref = useRef(null);
  const drag_start_x_ref = useRef(0);
  const drag_start_time_ref = useRef(0);
  const is_dragging_ref = useRef(false);
  const has_dragged_ref = useRef(false);

  // Normalized slides list
  const slides = normalize_card_slides(card);
  const total_slides = slides.length;

  // Local active slide index for immediate UI response
  const [current_active_index, set_current_active_index] = useState(() => {
    return Math.max(0, Math.min(card.active_slide_index ?? 0, Math.max(0, total_slides - 1)));
  });

  // Drag-to-slide state
  const [is_dragging_slide, set_is_dragging_slide] = useState(false);
  const [drag_offset, set_drag_offset] = useState(0);

  // File drag-over state
  const [is_file_drag_over, set_is_file_drag_over] = useState(false);

  // Toolbar & URL state
  const [show_url_input, set_show_url_input] = useState(false);
  const [url_draft, set_url_draft] = useState('');
  const [url_mode, set_url_mode] = useState('add'); // 'add' or 'replace'
  const [show_ai_prompt_popup, set_show_ai_prompt_popup] = useState(false);
  const [ai_popup_mode, set_ai_popup_mode] = useState('create_image'); // 'create_image' | 'visualize_creatively'
  const [ai_prompt_draft, set_ai_prompt_draft] = useState('');
  const [use_reference_image, set_use_reference_image] = useState(false);
  const [reference_strength, set_reference_strength] = useState(0.45);
  const [ai_image_size, set_ai_image_size] = useState(() => card.image_size || 'auto');
  const [ai_output_format, set_ai_output_format] = useState(() => card.output_format || 'jpg');
  const [ai_reasoning_strength, set_ai_reasoning_strength] = useState(
    () => card.reasoning_strength || 'high'
  );
  const [ai_image_search, set_ai_image_search] = useState(true);
  const [ai_web_search, set_ai_web_search] = useState(true);
  const [ai_shell, set_ai_shell] = useState(true);
  const [ai_auto_improve_prompt, set_ai_auto_improve_prompt] = useState(true);
  const [is_improving_prompt, set_is_improving_prompt] = useState(false);
  const [is_autoplay_active, set_is_autoplay_active] = useState(() => Boolean(card.autoplay));
  const [image_load_error, set_image_load_error] = useState(false);

  const autoplay_duration_sec = Math.max(
    0.5,
    Math.min(60, Number(card.autoplay_duration) || 3.5)
  );
  const autoplay_duration_ms = Math.round(autoplay_duration_sec * 1000);

  // Sync local autoplay state when card.autoplay changes from Card Property Panel
  useEffect(() => {
    set_is_autoplay_active(Boolean(card.autoplay));
  }, [card.autoplay]);

  // Keep local index in sync when card.active_slide_index or slides change externally
  useEffect(() => {
    if (typeof card.active_slide_index === 'number') {
      const clamped = Math.max(0, Math.min(card.active_slide_index, Math.max(0, total_slides - 1)));
      set_current_active_index(clamped);
    }
    set_image_load_error(false);
  }, [card.active_slide_index, total_slides, card.imageUrl]);

  // Current active slide object
  const active_slide = slides[current_active_index] || slides[0] || null;
  const resolved_caption_value =
    active_slide?.caption !== undefined && active_slide?.caption !== ''
      ? active_slide.caption
      : (card.caption || '');

  // Auto-size caption textarea downward whenever caption text, slide, or card dimensions change
  useEffect(() => {
    const el = caption_textarea_ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(22, el.scrollHeight)}px`;
  }, [resolved_caption_value, current_active_index, card.width, card.height]);

  // Sync saved note text height and observe user vertical resize on .lumen-carousel-note-text
  useEffect(() => {
    const el = note_text_ref.current;
    if (!el) return;

    const saved_h = Number(card.image_note_height);
    if (saved_h >= 40 && !note_resize_state_ref.current.is_pointer_down) {
      el.style.height = `${saved_h}px`;
      note_resize_state_ref.current.last_note_h = saved_h;
    }

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (!note_resize_state_ref.current.is_pointer_down) return;
      const new_h = Math.max(40, Math.round(el.offsetHeight || 68));
      const { start_note_h, start_card_h, last_note_h } = note_resize_state_ref.current;
      if (Math.abs(new_h - last_note_h) < 1) return;
      note_resize_state_ref.current.last_note_h = new_h;
      const delta_h = new_h - start_note_h;
      const next_card_h = Math.max(320, Math.round(start_card_h + delta_h));
      updateCard(
        card.id,
        {
          image_note_height: new_h,
          height: next_card_h,
        },
        false
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [card.id, card.ai_notes, card.content, card.image_note_height]);

  // Auto-play interval effect
  useEffect(() => {
    if (is_autoplay_active && total_slides > 1) {
      autoplay_timer_ref.current = setInterval(() => {
        handle_next_slide(false);
      }, autoplay_duration_ms);
    } else {
      if (autoplay_timer_ref.current) {
        clearInterval(autoplay_timer_ref.current);
      }
    }
    return () => {
      if (autoplay_timer_ref.current) {
        clearInterval(autoplay_timer_ref.current);
      }
    };
  }, [is_autoplay_active, total_slides, current_active_index, autoplay_duration_ms]);

  // Navigate to next slide (with wrap around)
  const handle_next_slide = (show_feedback = true) => {
    if (total_slides <= 1) return;
    const next_idx = (current_active_index + 1) % total_slides;
    set_slide_index(next_idx, show_feedback);
  };

  // Navigate to previous slide (with wrap around)
  const handle_prev_slide = (show_feedback = true) => {
    if (total_slides <= 1) return;
    const prev_idx = (current_active_index - 1 + total_slides) % total_slides;
    set_slide_index(prev_idx, show_feedback);
  };

  // Set explicit slide index
  const set_slide_index = (target_idx, show_feedback = false) => {
    if (target_idx < 0 || target_idx >= total_slides) return;
    const target_slide = slides[target_idx];
    if (!target_slide) return;

    // Immediately update local active state so transition begins
    set_current_active_index(target_idx);
    set_image_load_error(false);

    // Sync to board state
    updateCard(
      card.id,
      {
        active_slide_index: target_idx,
        images: slides,
        imageUrl: target_slide.url,
        caption: target_slide.caption || '',
      },
      false
    );
    saveCurrentBoardToStore();

    if (show_feedback) {
      showToast(`Slide ${target_idx + 1} of ${total_slides}`);
    }
  };

  // Open full screen / original resolution lightbox
  const handle_open_viewer = (mode = 'fit') => {
    if (!active_slide?.url) return;
    openImageViewer({
      cardId: card.id,
      title: card.title || 'Moodboard Photograph',
      slides: slides,
      activeIndex: current_active_index,
      initialMode: mode,
    });
  };

  // --- Drag Slide Feature (Mouse and Touch Swipe) ---
  const handle_pointer_down = (e) => {
    // Ignore interactive UI controls (buttons, inputs, toolbars, dots)
    if (
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest(`.${styles['lumen-carousel-toolbar']}`) ||
      e.target.closest(`.${styles['lumen-carousel-dots-wrap']}`) ||
      e.target.closest(`.${styles['lumen-carousel-url-editor']}`)
    ) {
      return;
    }

    if (total_slides <= 1) return;
    if (e.button !== undefined && e.button !== 0) return; // Only left click

    e.stopPropagation();

    const client_x = e.touches ? e.touches[0].clientX : e.clientX;
    drag_start_x_ref.current = client_x;
    drag_start_time_ref.current = Date.now();
    is_dragging_ref.current = true;
    has_dragged_ref.current = false;
    set_is_dragging_slide(true);
    set_drag_offset(0);

    const handle_pointer_move = (move_e) => {
      if (!is_dragging_ref.current) return;
      const current_x = move_e.touches ? move_e.touches[0].clientX : move_e.clientX;
      const delta = current_x - drag_start_x_ref.current;

      if (Math.abs(delta) > 4) {
        has_dragged_ref.current = true;
      }

      // Resistance at outer edges
      let adjusted_delta = delta;
      if (
        (current_active_index === 0 && delta > 0) ||
        (current_active_index === total_slides - 1 && delta < 0)
      ) {
        adjusted_delta = delta * 0.38;
      }

      set_drag_offset(adjusted_delta);
    };

    const handle_pointer_up = (up_e) => {
      if (!is_dragging_ref.current) return;
      is_dragging_ref.current = false;
      set_is_dragging_slide(false);

      window.removeEventListener('mousemove', handle_pointer_move);
      window.removeEventListener('mouseup', handle_pointer_up);
      window.removeEventListener('touchmove', handle_pointer_move);
      window.removeEventListener('touchend', handle_pointer_up);

      const end_x = up_e.changedTouches ? up_e.changedTouches[0].clientX : up_e.clientX;
      const delta = end_x - drag_start_x_ref.current;
      const elapsed = Date.now() - drag_start_time_ref.current;

      // Quick flick or dragged past 40px
      const is_quick_flick = elapsed < 300 && Math.abs(delta) > 25;
      const is_past_threshold = Math.abs(delta) > 40;

      if (is_quick_flick || is_past_threshold) {
        if (delta < 0) {
          // Dragged left -> advance to next slide
          if (current_active_index < total_slides - 1) {
            set_slide_index(current_active_index + 1, true);
          } else {
            // Loop around
            set_slide_index(0, true);
          }
        } else if (delta > 0) {
          // Dragged right -> return to previous slide
          if (current_active_index > 0) {
            set_slide_index(current_active_index - 1, true);
          } else {
            // Loop around
            set_slide_index(total_slides - 1, true);
          }
        }
      }

      set_drag_offset(0);
    };

    window.addEventListener('mousemove', handle_pointer_move);
    window.addEventListener('mouseup', handle_pointer_up);
    window.addEventListener('touchmove', handle_pointer_move, { passive: true });
    window.addEventListener('touchend', handle_pointer_up);
  };

  // Add one or more image URLs as slides
  const append_images_as_slides = (new_image_urls, is_replace_current = false) => {
    if (!new_image_urls || new_image_urls.length === 0) return;
    pushHistorySnapshot();

    let updated_slides = [...slides];
    let next_index = current_active_index;

    if (is_replace_current && total_slides > 0) {
      // Replace active slide
      updated_slides[current_active_index] = {
        ...updated_slides[current_active_index],
        url: new_image_urls[0],
      };
      // Append any additional ones
      for (let i = 1; i < new_image_urls.length; i++) {
        updated_slides.push({
          id: `slide_${Date.now()}_${i}`,
          url: new_image_urls[i],
          caption: '',
        });
      }
    } else {
      // Append as new slides
      const new_slide_objects = new_image_urls.map((url_str, idx) => ({
        id: `slide_${Date.now()}_${idx}`,
        url: url_str,
        caption: '',
      }));
      updated_slides = [...updated_slides, ...new_slide_objects];
      // Switch to the first newly added slide
      next_index = updated_slides.length - new_slide_objects.length;
    }

    const current_slide_obj = updated_slides[next_index] || updated_slides[0];
    set_current_active_index(next_index);

    updateCard(
      card.id,
      {
        images: updated_slides,
        active_slide_index: next_index,
        imageUrl: current_slide_obj?.url || '',
        caption: current_slide_obj?.caption || '',
      },
      true
    );

    saveCurrentBoardToStore();
    set_image_load_error(false);

    if (new_image_urls.length === 1) {
      showToast(is_replace_current ? 'Slide updated' : 'Slide added to carousel');
    } else {
      showToast(`Added ${new_image_urls.length} slides to carousel`);
    }
  };

  // Delete current slide
  const handle_delete_current_slide = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (total_slides <= 1) {
      showToast('Carousel needs at least one slide');
      return;
    }

    pushHistorySnapshot();
    const updated_slides = slides.filter((_, idx) => idx !== current_active_index);
    const new_index = Math.max(0, Math.min(current_active_index, updated_slides.length - 1));
    const next_slide = updated_slides[new_index];

    set_current_active_index(new_index);

    updateCard(
      card.id,
      {
        images: updated_slides,
        active_slide_index: new_index,
        imageUrl: next_slide?.url || '',
        caption: next_slide?.caption || '',
      },
      true
    );

    saveCurrentBoardToStore();
    showToast(`Slide deleted (${updated_slides.length} remaining)`);
  };

  // Download a single slide image
  const download_single_slide = async (slide_obj, slide_idx = 0) => {
    if (!slide_obj || !slide_obj.url) return;
    const raw_url = String(slide_obj.url).trim();
    const raw_label = String(
      slide_obj.caption || card.title || card.caption || 'lumen_image'
    ).trim();
    const clean_base =
      raw_label
        .replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48) || 'lumen_image';

    let ext = String(slide_obj.output_format || card.output_format || '').toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
      const data_match = raw_url.match(/^data:image\/([a-zA-Z0-9+.-]+);/i);
      const url_ext_match = raw_url.split('?')[0].match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
      if (data_match && data_match[1]) {
        ext = data_match[1].toLowerCase() === 'jpeg' ? 'jpg' : data_match[1].toLowerCase();
      } else if (url_ext_match && url_ext_match[1]) {
        ext = url_ext_match[1].toLowerCase() === 'jpeg' ? 'jpg' : url_ext_match[1].toLowerCase();
      } else {
        ext = 'jpg';
      }
    }

    const slide_suffix = total_slides > 1 ? `_slide_${slide_idx + 1}` : '';
    const file_name = `${clean_base}${slide_suffix}.${ext}`;

    const trigger_anchor_download = (href_url) => {
      const link = document.createElement('a');
      link.href = href_url;
      link.download = file_name;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (raw_url.startsWith('data:image/')) {
      trigger_anchor_download(raw_url);
      return;
    }

    const file_id_match = raw_url.match(/\/api\/files\/(?:view|download)\/([^/?#]+)/i);
    const resolved_file_id = slide_obj.file_id || (file_id_match ? file_id_match[1] : null);
    const fetch_target_url = resolved_file_id
      ? `/api/files/download/${resolved_file_id}`
      : raw_url;

    try {
      const resp = await fetch(fetch_target_url);
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob && blob.size > 0) {
          const blob_url = URL.createObjectURL(blob);
          trigger_anchor_download(blob_url);
          setTimeout(() => URL.revokeObjectURL(blob_url), 10000);
          return;
        }
      }
    } catch (_err) {
      // Fallback to direct anchor download if external CORS restricts fetch
    }

    trigger_anchor_download(fetch_target_url);
  };

  const handle_download_current_slide = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const target_slide = slides[current_active_index] || active_slide;
    if (!target_slide || !target_slide.url) {
      showToast('No image to download');
      return;
    }
    showToast(
      total_slides > 1
        ? `Downloading slide ${current_active_index + 1} of ${total_slides}...`
        : 'Downloading image...'
    );
    await download_single_slide(target_slide, current_active_index);
  };

  const handle_download_all_slides = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (total_slides === 0) return;
    showToast(`Downloading all ${total_slides} images...`);
    for (let i = 0; i < slides.length; i += 1) {
      await download_single_slide(slides[i], i);
      if (i < slides.length - 1) {
        await new Promise((r) => setTimeout(r, 220));
      }
    }
  };

  // Unpack / split a multi-slide carousel into separate individual Image Cards on the board for bird's-eye view
  const handle_split_carousel_to_cards = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (total_slides <= 1) return;

    pushHistorySnapshot();
    const first_slide = slides[0];
    const remaining_slides = slides.slice(1);
    const snap = snapToGridSignal.value;
    const base_x = Number(card.x || 0);
    const base_y = Number(card.y || 0);
    const card_w = Number(card.width || 384);
    const card_h = Number(card.height || 360);
    const gap = 24;

    // Keep first slide on current card
    set_current_active_index(0);
    updateCard(
      card.id,
      {
        images: [first_slide],
        active_slide_index: 0,
        imageUrl: first_slide.url,
        caption: first_slide.caption || '',
      },
      false
    );

    // Create separate cards for each remaining slide in a grid next to this card
    const cols = Math.min(3, remaining_slides.length + 1);
    remaining_slides.forEach((s, idx) => {
      const slot = idx + 1;
      const col = slot % cols;
      const row = Math.floor(slot / cols);
      let next_x = base_x + col * (card_w + gap);
      let next_y = base_y + row * (card_h + gap);
      if (snap) {
        next_x = snapToGrid(next_x);
        next_y = snapToGrid(next_y);
      }
      addCard({
        type: 'image',
        x: next_x,
        y: next_y,
        width: card_w,
        height: card_h,
        title: (s.caption || `${card.title || 'Image'} (${slot + 1})`).replace(/\.[^/.]+$/, ''),
        imageUrl: s.url,
        images: [{ id: s.id || `slide_${Date.now()}_${idx}`, url: s.url, caption: s.caption || '' }],
        active_slide_index: 0,
        caption: s.caption || '',
        color: card.color || 'white',
      });
    });

    saveCurrentBoardToStore();
    showToast(`Split ${total_slides} slides into separate image cards (Bird View)`);
  };

  // Handle local files (via file picker or drag-and-drop)
  const process_selected_files = (file_list, is_replace = false, from_drop = false) => {
    if (!file_list || file_list.length === 0) return;

    const valid_files = Array.from(file_list).filter(
      (f) =>
        (f.type && f.type.startsWith('image/')) ||
        /\.(png|jpe?g|webp|svg|gif|bmp|ico|avif)$/i.test(f.name || '')
    );
    if (valid_files.length === 0) {
      showToast('Please select valid image files');
      return;
    }

    const board_setting = activeBoardSignal.value?.board_setting || {};
    const is_each_card_mode =
      board_setting.drag_drop_images_action === 'each_card' ||
      board_setting.drag_drop_images_action === 'separate_cards';

    const read_promises = valid_files.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ name: file.name || 'Image', url: e.target.result });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(read_promises).then((results) => {
      const loaded = results.filter((r) => r && r.url);
      if (loaded.length === 0) return;

      if (from_drop && is_each_card_mode && (!is_replace || loaded.length > 1)) {
        const snap = snapToGridSignal.value;
        const base_x = Number(card.x || 0);
        const base_y = Number(card.y || 0);
        const card_w = Number(card.width || 384);
        const card_h = Number(card.height || 360);
        const gap = 24;

        let start_idx = 0;
        if (total_slides === 0) {
          // Populate current empty card with the first dropped image
          const first = loaded[0];
          const first_slide = [{ id: `slide_${Date.now()}_0`, url: first.url, caption: first.name }];
          set_current_active_index(0);
          updateCard(
            card.id,
            {
              title: first.name.replace(/\.[^/.]+$/, ''),
              images: first_slide,
              active_slide_index: 0,
              imageUrl: first.url,
              caption: first.name,
            },
            true
          );
          start_idx = 1;
        }

        const extra_items = loaded.slice(start_idx);
        const cols = Math.min(3, extra_items.length + 1);
        extra_items.forEach((item, idx) => {
          const slot = idx + 1;
          const col = slot % cols;
          const row = Math.floor(slot / cols);
          let next_x = base_x + col * (card_w + gap);
          let next_y = base_y + row * (card_h + gap);
          if (snap) {
            next_x = snapToGrid(next_x);
            next_y = snapToGrid(next_y);
          }
          const single_slide = [{ id: `slide_${Date.now()}_${idx + 1}`, url: item.url, caption: item.name }];
          addCard({
            type: 'image',
            x: next_x,
            y: next_y,
            width: card_w,
            height: card_h,
            title: item.name.replace(/\.[^/.]+$/, ''),
            imageUrl: item.url,
            images: single_slide,
            active_slide_index: 0,
            caption: item.name,
            color: card.color || 'white',
          });
        });

        saveCurrentBoardToStore();
        showToast(
          loaded.length > 1
            ? `Created ${loaded.length} separate image cards (Bird View)`
            : 'Created new image card (Bird View)'
        );
        return;
      }

      const data_urls = loaded.map((r) => r.url);
      append_images_as_slides(data_urls, is_replace);
    });
  };

  // Trigger file picker dialog
  const handle_trigger_file_dialog = (is_replace = false) => {
    set_url_mode(is_replace ? 'replace' : 'add');
    if (file_input_ref.current) {
      file_input_ref.current.click();
    }
  };

  const handle_file_input_change = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      process_selected_files(files, url_mode === 'replace', false);
    }
    e.target.value = '';
  };

  // Ensure file drag-over state is always cleared on any window drop or dragend
  useEffect(() => {
    const clear_file_drag = () => {
      set_is_file_drag_over((prev) => (prev ? false : prev));
    };
    window.addEventListener('drop', clear_file_drag, true);
    window.addEventListener('dragend', clear_file_drag, true);
    return () => {
      window.removeEventListener('drop', clear_file_drag, true);
      window.removeEventListener('dragend', clear_file_drag, true);
    };
  }, []);

  // Drag and drop handlers for external files
  const handle_file_drag_over = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!is_file_drag_over) {
      set_is_file_drag_over(true);
    }
  };

  const handle_file_drag_leave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.relatedTarget instanceof Node && e.currentTarget?.contains(e.relatedTarget)) {
      return;
    }
    set_is_file_drag_over(false);
  };

  const handle_file_drop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    set_is_file_drag_over(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      process_selected_files(files, total_slides === 0, true);
      return;
    }

    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (uri && (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:image/'))) {
      append_images_as_slides([uri.trim()], false);
    }
  };

  // Handle URL submit
  const handle_apply_url = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const clean_url = (url_draft || '').trim();
    if (!clean_url) {
      showToast('Please enter an image URL');
      return;
    }

    append_images_as_slides([clean_url], url_mode === 'replace');
    set_url_draft('');
    set_show_url_input(false);
  };

  // Update caption for active slide
  const handle_caption_change = (e, is_final = false) => {
    const new_caption = e.target.value;
    if (total_slides === 0) {
      updateCard(card.id, { caption: new_caption }, is_final);
      return;
    }

    const updated_slides = slides.map((s, idx) => {
      if (idx === current_active_index) {
        return { ...s, caption: new_caption };
      }
      return s;
    });

    updateCard(
      card.id,
      {
        images: updated_slides,
        caption: new_caption,
      },
      is_final
    );
  };

  const is_seamless = resolve_card_style(card, activeBoardSignal.value) === 'seamless';
  const has_card_note = !is_seamless && Boolean(card.ai_notes || card.content);

  return (
    <div ref={container_ref} className={styles['lumen-image-carousel-container']}>
      {/* Hidden file input supporting multiple files */}
      <input
        ref={file_input_ref}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handle_file_input_change}
      />

      {/* Top Header Bar (Outside image): Active counter, Auto-play, and Quick Actions */}
      {!is_seamless && (
      <div
        ref={top_bar_ref}
        className={styles['lumen-carousel-top-bar']}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles['lumen-carousel-top-left']}>
          {total_slides > 1 ? (
            <div className={styles['lumen-carousel-counter-group']}>
              <button
                type="button"
                className={styles['lumen-carousel-top-nav-btn']}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handle_prev_slide(true);
                }}
                title="Previous slide"
                aria-label="Previous slide"
              >
                <ChevronLeft size={12} />
              </button>
              <div className={styles['lumen-carousel-counter-badge']}>
                <span>
                  {current_active_index + 1} / {total_slides}
                </span>
              </div>
              <button
                type="button"
                className={styles['lumen-carousel-top-nav-btn']}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handle_next_slide(true);
                }}
                title="Next slide"
                aria-label="Next slide"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          ) : (
            <span className={styles['lumen-carousel-single-badge']}>
              {total_slides === 1 ? '1 Slide' : 'Empty'}
            </span>
          )}

          {total_slides > 1 && (
            <button
              type="button"
              className={`${styles['lumen-carousel-autoplay-btn']} ${
                is_autoplay_active ? styles['lumen-carousel-autoplay-btn-active'] : ''
              }`}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                const next_autoplay = !is_autoplay_active;
                set_is_autoplay_active(next_autoplay);
                updateCard(card.id, { autoplay: next_autoplay }, false);
                saveCurrentBoardToStore();
                showToast(
                  next_autoplay
                    ? `Slideshow playing (${autoplay_duration_sec}s per slide)`
                    : 'Slideshow paused'
                );
              }}
              title={
                is_autoplay_active
                  ? 'Pause slideshow'
                  : `Auto-play slideshow (${autoplay_duration_sec}s)`
              }
            >
              {is_autoplay_active ? <Pause size={10} /> : <Play size={10} />}
              <span>{is_autoplay_active ? 'Pause' : 'Play'}</span>
            </button>
          )}
        </div>

        {/* Action Controls Toolbar outside image */}
        <div className={styles['lumen-carousel-toolbar']}>
          <button
            type="button"
            className={styles['lumen-carousel-toolbar-btn']}
            onClick={() => handle_trigger_file_dialog(false)}
            title="Add image slide to carousel"
          >
            <Plus size={12} />
            <span>Add</span>
          </button>

          <button
            type="button"
            className={styles['lumen-carousel-toolbar-btn']}
            onClick={() => handle_trigger_file_dialog(true)}
            title="Replace current slide with file"
          >
            <Upload size={11} />
            <span>Upload</span>
          </button>

          <button
            type="button"
            className={`${styles['lumen-carousel-toolbar-btn']} ${
              show_url_input ? styles['lumen-carousel-toolbar-btn-active'] : ''
            }`}
            onClick={() => {
              set_show_url_input(!show_url_input);
              set_show_ai_prompt_popup(false);
              set_url_mode('add');
            }}
            title="Add slide via URL"
          >
            <Link2 size={11} />
            <span>URL</span>
          </button>

          <button
            type="button"
            className={`${styles['lumen-carousel-toolbar-btn']} ${
              show_ai_prompt_popup && ai_popup_mode === 'create_image'
                ? styles['lumen-carousel-toolbar-btn-active']
                : ''
            }`}
            onClick={() => {
              if (show_ai_prompt_popup && ai_popup_mode === 'create_image') {
                set_show_ai_prompt_popup(false);
              } else {
                set_ai_popup_mode('create_image');
                set_show_ai_prompt_popup(true);
                set_show_url_input(false);
              }
            }}
            title="AI Command: Create Image with prompt using Board List AI model"
          >
            <Sparkles size={11} />
            <span>Create Image</span>
          </button>

          {total_slides > 0 && active_slide?.url && (
            <button
              type="button"
              className={`${styles['lumen-carousel-toolbar-btn']} ${
                show_ai_prompt_popup && ai_popup_mode === 'visualize_creatively'
                  ? styles['lumen-carousel-toolbar-btn-active']
                  : ''
              }`}
              onClick={() => {
                if (show_ai_prompt_popup && ai_popup_mode === 'visualize_creatively') {
                  set_show_ai_prompt_popup(false);
                } else {
                  set_ai_popup_mode('visualize_creatively');
                  set_show_ai_prompt_popup(true);
                  set_show_url_input(false);
                }
              }}
              title="Visualize image creatively: generate a love poem, joke, motivational quote, or greeting (Muse Wonder)"
            >
              <Sparkles size={11} />
              <span>Visualize</span>
            </button>
          )}

          {/* Download, Full Screen View & 1:1 Original Resolution */}
          {total_slides > 0 && active_slide?.url && (
            <>
              <button
                type="button"
                className={styles['lumen-carousel-toolbar-btn']}
                onClick={handle_download_current_slide}
                title={
                  total_slides > 1
                    ? `Download current image (Slide ${current_active_index + 1} of ${total_slides})`
                    : 'Download image'
                }
              >
                <Download size={11} />
                <span>Download</span>
              </button>

              {total_slides > 1 && (
                <button
                  type="button"
                  className={styles['lumen-carousel-toolbar-btn']}
                  onClick={handle_download_all_slides}
                  title={`Download all ${total_slides} images in this carousel`}
                >
                  <Download size={11} />
                  <span>All ({total_slides})</span>
                </button>
              )}

              <button
                type="button"
                className={styles['lumen-carousel-toolbar-btn']}
                onClick={() => handle_open_viewer('fit')}
                title="View image full screen (Fit)"
              >
                <Maximize2 size={11} />
              </button>

              <button
                type="button"
                className={styles['lumen-carousel-toolbar-btn']}
                onClick={() => handle_open_viewer('original')}
                title="View image at 1:1 natural original resolution"
              >
                <Scan size={11} />
              </button>
            </>
          )}

          {total_slides > 1 && (
            <>
              <button
                type="button"
                className={styles['lumen-carousel-toolbar-btn']}
                onClick={handle_split_carousel_to_cards}
                title="Split all carousel slides into separate individual Image Cards (Bird View)"
              >
                <LayoutGrid size={11} />
              </button>

              <button
                type="button"
                className={`${styles['lumen-carousel-toolbar-btn']} ${styles['lumen-carousel-toolbar-btn-danger']}`}
                onClick={handle_delete_current_slide}
                title="Delete current slide"
              >
                <Trash2 size={11} />
              </button>
            </>
          )}
        </div>
      </div>
      )}

      {/* Inline URL Input Editor (Outside image area - zero overlap) */}
      {!is_seamless && show_url_input && (
        <div
          className={styles['lumen-carousel-url-editor']}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className={styles['lumen-carousel-url-input-wrap']}>
            <Link2 size={13} style={{ color: 'var(--lumen-text-muted)', flexShrink: 0 }} />
            <input
              type="url"
              className={styles['lumen-carousel-url-input']}
              value={url_draft}
              onChange={(e) => set_url_draft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handle_apply_url(e);
                if (e.key === 'Escape') set_show_url_input(false);
              }}
              placeholder="Paste image URL (https://...)"
              autoFocus
            />
            {url_draft && (
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--lumen-text-muted)',
                }}
                onClick={() => set_url_draft('')}
                title="Clear input"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className={styles['lumen-carousel-url-actions']}>
            <button
              type="button"
              className={styles['lumen-carousel-url-cancel-btn']}
              onClick={() => set_show_url_input(false)}
            >
              Cancel
            </button>
            {total_slides > 0 && (
              <button
                type="button"
                className={styles['lumen-carousel-url-apply-btn']}
                style={{
                  background: 'var(--lumen-surface-subtle)',
                  color: 'var(--lumen-text-primary)',
                }}
                onClick={(e) => {
                  set_url_mode('replace');
                  handle_apply_url(e);
                }}
              >
                Replace Current
              </button>
            )}
            <button
              type="button"
              className={styles['lumen-carousel-url-apply-btn']}
              onClick={(e) => {
                set_url_mode('add');
                handle_apply_url(e);
              }}
            >
              + Add Slide
            </button>
          </div>
        </div>
      )}

      {/* Inline AI Create Image / Visualize Creatively Prompt Popup */}
      {!is_seamless && show_ai_prompt_popup && (
        (() => {
          const selected_image_model = getSelectedAiModelForTask('image_gen');
          const is_busy = Boolean(isCardAiProcessingSignal.value);
          const is_visualize_mode = ai_popup_mode === 'visualize_creatively';
          const has_active_ref_slide = Boolean(total_slides > 0 && active_slide?.url);
          const effective_use_ref = Boolean(
            !is_visualize_mode && use_reference_image && has_active_ref_slide
          );
          const active_action_id = is_visualize_mode
            ? 'image_visualize_creatively'
            : 'image_create_image';
          return (
            <div
              className={styles['lumen-carousel-url-editor']}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className={styles['lumen-carousel-ai-header']}>
                <span className={styles['lumen-carousel-ai-title']}>
                  <Sparkles size={12} />
                  <span>
                    {is_visualize_mode
                      ? 'Visualize Image Creatively (Love Poem / Joke / Quote)'
                      : effective_use_ref
                      ? `Progressive Edit from Slide ${current_active_index + 1}`
                      : 'Create Image (AI Prompt)'}
                  </span>
                </span>
                <span
                  className={styles['lumen-carousel-ai-model-badge']}
                  title={
                    is_visualize_mode
                      ? 'Creative AI: Meta Muse Wonder (muse-wonder-1.0)'
                      : `Board List Image Gen Model: ${selected_image_model.full_name}`
                  }
                >
                  {is_visualize_mode
                    ? 'muse-wonder-1.0'
                    : `Model: ${selected_image_model.name}`}
                </span>
              </div>

              {is_visualize_mode ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 5,
                    marginBottom: 8,
                  }}
                >
                  {[
                    {
                      label: 'Love Poem',
                      prompt: 'Write a romantic love poem inspired by this image',
                    },
                    {
                      label: 'Witty Joke',
                      prompt: 'Tell a witty, lighthearted joke about this scene',
                    },
                    {
                      label: 'Motivational Quote',
                      prompt: 'Create an uplifting motivational quote from this visual',
                    },
                    {
                      label: 'Warm Greeting',
                      prompt: 'Write a warm, poetic greeting card message inspired by this image',
                    },
                    {
                      label: 'Mindful Reflection',
                      prompt: 'Mindful sensory visualization & calming reflection on this image',
                    },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => set_ai_prompt_draft(chip.prompt)}
                      style={{
                        padding: '3px 8px',
                        fontSize: 10.5,
                        fontWeight: 600,
                        borderRadius: 999,
                        border:
                          ai_prompt_draft === chip.prompt
                            ? '1px solid rgba(124, 58, 237, 0.55)'
                            : '1px solid var(--lumen-border, #e2e8f0)',
                        background:
                          ai_prompt_draft === chip.prompt
                            ? 'rgba(124, 58, 237, 0.14)'
                            : 'var(--lumen-surface-subtle, #f8fafc)',
                        color:
                          ai_prompt_draft === chip.prompt
                            ? '#6d28d9'
                            : 'var(--lumen-text-secondary, #475569)',
                        cursor: 'pointer',
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  {has_active_ref_slide && (
                    <div
                      className={`${styles['lumen-carousel-ref-box']} ${
                        effective_use_ref ? styles['lumen-carousel-ref-box-active'] : ''
                      }`}
                    >
                      <div className={styles['lumen-carousel-ref-toggle-row']}>
                        <label className={styles['lumen-carousel-ref-label']}>
                          <input
                            type="checkbox"
                            className={styles['lumen-carousel-ref-checkbox']}
                            checked={effective_use_ref}
                            onChange={(e) => set_use_reference_image(e.target.checked)}
                          />
                          <span>Use current active image as reference</span>
                        </label>
                        <div
                          className={styles['lumen-carousel-ref-thumb-wrap']}
                          title={`Active reference: Slide ${current_active_index + 1} of ${total_slides}`}
                        >
                          <img
                            src={active_slide.url}
                            alt={`Slide ${current_active_index + 1}`}
                            className={styles['lumen-carousel-ref-thumb']}
                          />
                          <span className={styles['lumen-carousel-ref-slide-tag']}>
                            Slide {current_active_index + 1}/{total_slides}
                          </span>
                        </div>
                      </div>

                      {effective_use_ref && (
                        <div className={styles['lumen-carousel-ref-strength-wrap']}>
                          <div className={styles['lumen-carousel-ref-strength-top']}>
                            <span className={styles['lumen-carousel-ref-strength-title']}>
                              Edit Strength (0.3–0.5 preserves layout & lighting):
                            </span>
                            <div className={styles['lumen-carousel-ref-strength-pills']}>
                              {[
                                { val: 0.35, label: '0.35 Subtle' },
                                { val: 0.45, label: '0.45 Preserve' },
                                { val: 0.75, label: '0.75 Strong' },
                              ].map((preset) => (
                                <button
                                  key={preset.val}
                                  type="button"
                                  className={`${styles['lumen-carousel-ref-strength-pill']} ${
                                    Math.abs(reference_strength - preset.val) < 0.03
                                      ? styles['lumen-carousel-ref-strength-pill-active']
                                      : ''
                                  }`}
                                  onClick={() => set_reference_strength(preset.val)}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className={styles['lumen-carousel-ref-slider-row']}>
                            <input
                              type="range"
                              min="0.30"
                              max="0.90"
                              step="0.05"
                              value={reference_strength}
                              onChange={(e) => set_reference_strength(Number(e.target.value))}
                              className={styles['lumen-carousel-ref-slider']}
                            />
                            <span className={styles['lumen-carousel-ref-strength-val']}>
                              {reference_strength.toFixed(2)}
                            </span>
                          </div>
                          <div className={styles['lumen-carousel-ref-hint']}>
                            AI will continue from Slide {current_active_index + 1} — describe only the change to make.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Create Image Options: Size, Format (default jpg), Reasoning Strength, Image Search, Web Search, Shell */}
                  <div className={styles['lumen-carousel-ai-options-box']}>
                    <div className={styles['lumen-carousel-ai-options-grid']}>
                      <label className={styles['lumen-carousel-ai-option-field']}>
                        <span className={styles['lumen-carousel-ai-option-label']}>Size</span>
                        <select
                          value={ai_image_size}
                          onChange={(e) => set_ai_image_size(e.target.value)}
                          className={styles['lumen-carousel-ai-option-select']}
                        >
                          <option value="auto">auto</option>
                          <option value="1024x1024">1024x1024</option>
                          <option value="1024x1536">1024x1536</option>
                          <option value="1536x1024">1536x1024</option>
                        </select>
                      </label>

                      <label className={styles['lumen-carousel-ai-option-field']}>
                        <span className={styles['lumen-carousel-ai-option-label']}>Format</span>
                        <select
                          value={ai_output_format}
                          onChange={(e) => set_ai_output_format(e.target.value)}
                          className={styles['lumen-carousel-ai-option-select']}
                        >
                          <option value="jpg">jpg (default)</option>
                          <option value="png">png</option>
                          <option value="webp">webp</option>
                        </select>
                      </label>

                      <label className={styles['lumen-carousel-ai-option-field']}>
                        <span className={styles['lumen-carousel-ai-option-label']}>
                          Reasoning Strength
                        </span>
                        <select
                          value={ai_reasoning_strength}
                          onChange={(e) => set_ai_reasoning_strength(e.target.value)}
                          className={styles['lumen-carousel-ai-option-select']}
                        >
                          <option value="high">high</option>
                          <option value="low">low</option>
                        </select>
                      </label>
                    </div>

                    <div className={styles['lumen-carousel-ai-tools-row']}>
                      <label
                        className={`${styles['lumen-carousel-ai-tool-toggle']} ${
                          ai_image_search ? styles['lumen-carousel-ai-tool-toggle-active'] : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={ai_image_search}
                          onChange={(e) => set_ai_image_search(e.target.checked)}
                          className={styles['lumen-carousel-ai-tool-checkbox']}
                        />
                        <span>Image Search: {ai_image_search ? 'on' : 'off'}</span>
                      </label>

                      <label
                        className={`${styles['lumen-carousel-ai-tool-toggle']} ${
                          ai_web_search ? styles['lumen-carousel-ai-tool-toggle-active'] : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={ai_web_search}
                          onChange={(e) => set_ai_web_search(e.target.checked)}
                          className={styles['lumen-carousel-ai-tool-checkbox']}
                        />
                        <span>Web Search: {ai_web_search ? 'on' : 'off'}</span>
                      </label>

                      <label
                        className={`${styles['lumen-carousel-ai-tool-toggle']} ${
                          ai_shell ? styles['lumen-carousel-ai-tool-toggle-active'] : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={ai_shell}
                          onChange={(e) => set_ai_shell(e.target.checked)}
                          className={styles['lumen-carousel-ai-tool-checkbox']}
                        />
                        <span>Shell: {ai_shell ? 'on' : 'off'}</span>
                      </label>

                      <label
                        className={`${styles['lumen-carousel-ai-tool-toggle']} ${
                          ai_auto_improve_prompt
                            ? styles['lumen-carousel-ai-tool-toggle-active']
                            : ''
                        }`}
                        title="Automatically expand and enrich your prompt using muse-wonder-1.0 before generating the image"
                      >
                        <input
                          type="checkbox"
                          checked={ai_auto_improve_prompt}
                          onChange={(e) => set_ai_auto_improve_prompt(e.target.checked)}
                          className={styles['lumen-carousel-ai-tool-checkbox']}
                        />
                        <span>
                          ✨ Auto-Improve Prompt (muse-wonder-1.0):{' '}
                          {ai_auto_improve_prompt ? 'on' : 'off'}
                        </span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className={styles['lumen-carousel-url-input-wrap']}>
                <Sparkles size={13} />
                <input
                  type="text"
                  className={styles['lumen-carousel-url-input']}
                  value={ai_prompt_draft}
                  onChange={(e) => set_ai_prompt_draft(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (is_busy || is_improving_prompt) return;
                      const prompt_val = ai_prompt_draft.trim();
                      set_ai_prompt_draft('');
                      set_show_ai_prompt_popup(false);
                      await runAiCardAction(
                        card.id,
                        active_action_id,
                        prompt_val,
                        is_visualize_mode
                          ? { active_slide_index: current_active_index }
                          : {
                              use_reference_image: effective_use_ref,
                              reference_strength,
                              active_slide_index: current_active_index,
                              reference_image_url: active_slide?.url || card.imageUrl || '',
                              reference_file_id: active_slide?.file_id || card.file_id || null,
                              image_size: ai_image_size,
                              output_format: ai_output_format,
                              reasoning_strength: ai_reasoning_strength,
                              enable_image_search: ai_image_search,
                              enable_web_search: ai_web_search,
                              enable_shell: ai_shell,
                              auto_improve_prompt: ai_auto_improve_prompt,
                            }
                      );
                    }
                    if (e.key === 'Escape') {
                      set_show_ai_prompt_popup(false);
                    }
                  }}
                  placeholder={
                    is_visualize_mode
                      ? 'Describe creative visualization (e.g. love poem, funny joke, motivational quote)...'
                      : effective_use_ref
                      ? `Describe change to Slide ${current_active_index + 1} (e.g. Add Halloween pumpkins, keep layout & lighting)...`
                      : `Enter prompt to create image with ${selected_image_model.name}...`
                  }
                  autoFocus
                />
                {!is_visualize_mode && (
                  <button
                    type="button"
                    disabled={is_busy || is_improving_prompt}
                    className={styles['lumen-carousel-url-cancel-btn']}
                    onClick={async () => {
                      if (is_improving_prompt) return;
                      set_is_improving_prompt(true);
                      try {
                        const res = await improveImagePromptWithMuse(
                          card.id,
                          ai_prompt_draft.trim(),
                          {
                            use_reference_image: effective_use_ref,
                            active_slide_index: current_active_index,
                          }
                        );
                        if (res?.improvedPrompt) {
                          set_ai_prompt_draft(res.improvedPrompt);
                        }
                      } finally {
                        set_is_improving_prompt(false);
                      }
                    }}
                    title="Rewrite & improve prompt right now using muse-wonder-1.0"
                  >
                    {is_improving_prompt ? 'Improving...' : '✨ Improve'}
                  </button>
                )}
                {ai_prompt_draft && (
                  <button
                    type="button"
                    className={styles['lumen-carousel-url-cancel-btn']}
                    onClick={() => set_ai_prompt_draft('')}
                    title="Clear prompt"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className={styles['lumen-carousel-url-actions']}>
                <button
                  type="button"
                  className={styles['lumen-carousel-url-cancel-btn']}
                  onClick={() => set_show_ai_prompt_popup(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={is_busy || is_improving_prompt}
                  className={styles['lumen-carousel-url-apply-btn']}
                  onClick={async () => {
                    const prompt_val = ai_prompt_draft.trim();
                    set_ai_prompt_draft('');
                    set_show_ai_prompt_popup(false);
                    await runAiCardAction(
                      card.id,
                      active_action_id,
                      prompt_val,
                      is_visualize_mode
                        ? { active_slide_index: current_active_index }
                        : {
                            use_reference_image: effective_use_ref,
                            reference_strength,
                            active_slide_index: current_active_index,
                            reference_image_url: active_slide?.url || card.imageUrl || '',
                            reference_file_id: active_slide?.file_id || card.file_id || null,
                            image_size: ai_image_size,
                            output_format: ai_output_format,
                            reasoning_strength: ai_reasoning_strength,
                            enable_image_search: ai_image_search,
                            enable_web_search: ai_web_search,
                            enable_shell: ai_shell,
                            auto_improve_prompt: ai_auto_improve_prompt,
                          }
                    );
                  }}
                >
                  <Sparkles size={11} />
                  <span>
                    {is_busy
                      ? 'Generating...'
                      : is_visualize_mode
                      ? 'Visualize (Muse Wonder)'
                      : effective_use_ref
                      ? `Edit Slide ${current_active_index + 1} (${selected_image_model.name})`
                      : `Create Image (${selected_image_model.name})`}
                  </span>
                </button>
              </div>
            </div>
          );
        })()
      )}

      {/* Main Image Stage (Drag slide left/right enabled, zero overlapping buttons, black background, object-fit contain) */}
      <div
        ref={image_area_ref}
        className={`${styles['lumen-carousel-image-area']} ${
          total_slides > 1 ? styles['lumen-carousel-image-area-draggable'] : ''
        } ${is_dragging_slide ? styles['lumen-carousel-image-area-dragging'] : ''} ${
          is_file_drag_over ? styles['lumen-carousel-image-area-drag-over'] : ''
        }`}
        data-lumen-no-card-drag={total_slides > 1 ? 'true' : undefined}
        onMouseDown={handle_pointer_down}
        onTouchStart={handle_pointer_down}
        onDragOver={handle_file_drag_over}
        onDragEnter={handle_file_drag_over}
        onDragLeave={handle_file_drag_leave}
        onDrop={handle_file_drop}
      >
        {/* External file drag-over dropzone overlay */}
        {is_file_drag_over && (
          <div className={styles['lumen-carousel-drop-zone']}>
            <Upload size={28} className={styles['lumen-carousel-drop-icon']} />
            <span>Drop image(s) here to add to slides</span>
          </div>
        )}

        {/* Sliding Carousel Track */}
        {total_slides > 0 && !image_load_error ? (
          <div className={styles['lumen-carousel-viewport']}>
            <div
              className={styles['lumen-carousel-track']}
              style={{
                transform: `translateX(calc(-${current_active_index * 100}% + ${drag_offset}px))`,
                transition: is_dragging_slide
                  ? 'none'
                  : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {slides.map((slide, idx) => (
                <div
                  key={slide.id || idx}
                  className={styles['lumen-carousel-slide-item']}
                  onDoubleClick={() => handle_open_viewer('fit')}
                  title="Double-click to view full screen or 1:1 original resolution"
                >
                  <img
                    src={slide.url}
                    alt={slide.caption || card.title || 'Moodboard photograph slide'}
                    className={styles['lumen-carousel-slide-img']}
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const topic_hint = encodeURIComponent(
                        (slide.caption || card.title || 'Studio Product Photography').slice(0, 80)
                      );
                      const fallback_url = `/api/ai/card-image?topic=${topic_hint}&step=${idx}`;
                      if (e.currentTarget.src !== fallback_url && !e.currentTarget.dataset.retried) {
                        e.currentTarget.dataset.retried = 'true';
                        e.currentTarget.src = fallback_url;
                        return;
                      }
                      if (idx === current_active_index) {
                        set_image_load_error(true);
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className={styles['lumen-carousel-empty-placeholder']}
            onClick={() => handle_trigger_file_dialog(false)}
          >
            <ImageIcon size={32} className={styles['lumen-carousel-empty-icon']} />
            <div className={styles['lumen-carousel-empty-text']}>
              {image_load_error ? 'Could not load slide image' : 'No images in carousel'}
            </div>
            <div className={styles['lumen-carousel-empty-subtext']}>
              Drag &amp; drop multiple image files here, or click to upload
            </div>
            <div
              className={styles['lumen-carousel-empty-actions']}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles['lumen-carousel-empty-btn']}
                onClick={() => handle_trigger_file_dialog(false)}
              >
                <Upload size={12} />
                Upload Images
              </button>
              <button
                type="button"
                className={styles['lumen-carousel-empty-btn']}
                onClick={() => {
                  set_show_url_input(true);
                  set_show_ai_prompt_popup(false);
                  set_url_mode('add');
                }}
              >
                <Link2 size={12} />
                Add URL
              </button>
              <button
                type="button"
                className={styles['lumen-carousel-empty-btn']}
                onClick={() => {
                  set_show_ai_prompt_popup(true);
                  set_show_url_input(false);
                }}
              >
                <Sparkles size={12} />
                Create Image
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide Navigation Controls Bar (Outside image area - zero overlap) */}
      {!is_seamless && total_slides > 1 && (
        <div
          ref={nav_bar_ref}
          className={styles['lumen-carousel-nav-bar']}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`${styles['lumen-carousel-nav-btn']} ${styles['lumen-carousel-nav-btn-prev']}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handle_prev_slide(true);
            }}
            title="Previous slide"
            aria-label="Previous slide"
          >
            <ChevronLeft size={15} />
            <span>Prev</span>
          </button>

          {/* Dots Indicator */}
          <div className={styles['lumen-carousel-dots-wrap']}>
            {slides.map((_, idx) => (
              <div
                key={idx}
                className={`${styles['lumen-carousel-dot']} ${
                  idx === current_active_index ? styles['lumen-carousel-dot-active'] : ''
                }`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  set_slide_index(idx, true);
                }}
                title={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            className={`${styles['lumen-carousel-nav-btn']} ${styles['lumen-carousel-nav-btn-next']}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handle_next_slide(true);
            }}
            title="Next slide"
            aria-label="Next slide"
          >
            <span>Next</span>
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Slide Caption Input */}
      {!is_seamless && (
        <textarea
          ref={caption_textarea_ref}
          rows={1}
          className={styles['lumen-carousel-caption-input']}
          value={
            active_slide?.caption !== undefined && active_slide?.caption !== ''
              ? active_slide.caption
              : (card.caption || '')
          }
          title={
            active_slide?.caption !== undefined && active_slide?.caption !== ''
              ? active_slide.caption
              : (card.caption || '')
          }
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
            handle_caption_change(e, false);
          }}
          onBlur={(e) => handle_caption_change(e, true)}
          placeholder={
            total_slides > 1
              ? `Slide ${current_active_index + 1} caption or credit...`
              : 'Add caption or credit...'
          }
        />
      )}

      {/* Card Note / AI Visual Mood & Creative Visualization */}
      {!is_seamless && (card.ai_notes || card.content) && (
        <div
          ref={note_box_ref}
          className={styles['lumen-carousel-card-note']}
          data-lumen-no-card-drag="true"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className={styles['lumen-carousel-note-label']}>
            {card.ai_notes ? <Sparkles size={11} /> : <FileText size={11} />}
            <span>
              {card.ai_note_title || (card.ai_notes ? 'Visual Mood & Lighting' : 'Note')}
            </span>
            <button
              type="button"
              className={styles['lumen-carousel-note-clear-btn']}
              onClick={(e) => {
                e.stopPropagation();
                const current_h = Number(card.height) || 460;
                const extra_note_h =
                  Number(card.image_note_height) > 68 ? Number(card.image_note_height) - 68 : 0;
                const restored_h =
                  card.base_height_without_note
                    ? Number(card.base_height_without_note)
                    : current_h >= 440 && current_h <= 480
                    ? 360
                    : Math.max(260, current_h - 100 - extra_note_h);
                updateCard(
                  card.id,
                  {
                    ai_notes: '',
                    content: '',
                    ai_note_title: '',
                    image_note_height: 0,
                    base_height_without_note: null,
                    height: restored_h,
                  },
                  true
                );
                saveCurrentBoardToStore();
              }}
              title="Dismiss note"
              aria-label="Dismiss note"
            >
              <X size={11} />
            </button>
          </div>
          <div
            ref={note_text_ref}
            className={styles['lumen-carousel-note-text']}
            data-lumen-no-card-drag="true"
            onMouseDown={(e) => {
              e.stopPropagation();
              mark_card_interaction_start([card.id]);
              const el = note_text_ref.current;
              const cur_note_h = Math.max(40, Math.round(el?.offsetHeight || Number(card.image_note_height) || 68));
              note_resize_state_ref.current = {
                is_pointer_down: true,
                start_note_h: cur_note_h,
                start_card_h: Number(card.height) || 460,
                last_note_h: cur_note_h,
              };
              const handle_win_mouse_up = () => {
                window.removeEventListener('mouseup', handle_win_mouse_up, true);
                mark_card_interaction_end([card.id]);
                if (!note_resize_state_ref.current.is_pointer_down) return;
                note_resize_state_ref.current.is_pointer_down = false;
                const final_el = note_text_ref.current;
                if (!final_el) return;
                const final_h = Math.max(40, Math.round(final_el.offsetHeight || 68));
                if (Math.abs(final_h - note_resize_state_ref.current.start_note_h) >= 2) {
                  const delta_h = final_h - note_resize_state_ref.current.start_note_h;
                  const next_card_h = Math.max(
                    320,
                    Math.round(note_resize_state_ref.current.start_card_h + delta_h)
                  );
                  updateCard(
                    card.id,
                    {
                      image_note_height: final_h,
                      height: next_card_h,
                    },
                    true
                  );
                  saveCurrentBoardToStore({ immediate: true });
                }
              };
              window.addEventListener('mouseup', handle_win_mouse_up, true);
            }}
          >
            {card.ai_notes || card.content}
          </div>
        </div>
      )}
    </div>
  );
}
