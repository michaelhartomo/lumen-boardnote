import { useState, useRef } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useNavigate } from 'react-router';
import { X, Upload, FileCode } from 'lucide-react';
import styles from './TemplateModal.module.css';
import {
  isTemplateModalOpenSignal,
  loadTemplate,
  BOARD_TEMPLATES,
  createBoardFromExportConfig,
  showToast,
} from '../../signals/boardState.js';

export function LUMEN_template_modal() {
  useSignals();
  const navigate = useNavigate();
  const [show_paste_area, set_show_paste_area] = useState(false);
  const [pasted_json, set_pasted_json] = useState('');
  const file_input_ref = useRef(null);

  const handle_close = () => {
    isTemplateModalOpenSignal.value = false;
  };

  const handle_select_template = (key) => {
    const new_board_id = loadTemplate(key);
    if (new_board_id && typeof navigate === 'function') {
      navigate(`/board/${new_board_id}`);
    }
  };

  const handle_import_file = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw_text = await file.text();
      const parsed = JSON.parse(raw_text);
      const new_board_id = createBoardFromExportConfig(parsed, {
        activate: true,
        toastMessage: `Created board from shared config "${parsed.title || parsed.board_name || file.name.replace(/\.json$/i, '')}"`,
      });
      if (new_board_id) {
        isTemplateModalOpenSignal.value = false;
        if (typeof navigate === 'function') {
          navigate(`/board/${new_board_id}`);
        }
      }
    } catch (err) {
      showToast('Invalid board configuration JSON file');
    } finally {
      if (file_input_ref.current) {
        file_input_ref.current.value = '';
      }
    }
  };

  const handle_create_from_paste = () => {
    const trimmed = pasted_json.trim();
    if (!trimmed) {
      showToast('Paste a board configuration JSON first');
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      const new_board_id = createBoardFromExportConfig(parsed, {
        activate: true,
        toastMessage: `Created board from shared config "${parsed.title || parsed.board_name || 'Shared Board'}"`,
      });
      if (new_board_id) {
        set_pasted_json('');
        set_show_paste_area(false);
        isTemplateModalOpenSignal.value = false;
        if (typeof navigate === 'function') {
          navigate(`/board/${new_board_id}`);
        }
      }
    } catch (err) {
      showToast('Invalid JSON format in pasted board configuration');
    }
  };

  const template_list = Object.entries(BOARD_TEMPLATES).map(([key, data]) => {
    const board_payload = data?.board || data || {};
    const cards_arr = Array.isArray(board_payload.cards)
      ? board_payload.cards
      : Array.isArray(data.cards)
      ? data.cards
      : [];
    const conns_arr = Array.isArray(board_payload.connections)
      ? board_payload.connections
      : Array.isArray(data.connections)
      ? data.connections
      : [];
    const b_type = board_payload.boardType || board_payload.board_type || data.boardType || 'snap_grid';
    return {
      key,
      title: board_payload.title || data.title || key,
      description: board_payload.description || data.description || 'Pre-designed board layout and cards.',
      type: b_type === 'free_position' ? 'Free Position' : 'Snap to Grid',
      card_count: cards_arr.length,
      connection_count: conns_arr.length,
      format: data.format || 'lumen_board_export',
    };
  });

  return (
    <div
      className={styles['lumen-modal-backdrop'] || styles.lumenModalBackdrop}
      onClick={handle_close}
    >
      <div
        className={styles['lumen-modal-window'] || styles.lumenModalWindow}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles['lumen-modal-header'] || styles.lumenModalHeader}>
          <div className={styles['lumen-modal-title'] || styles.lumenModalTitle}>
            Choose Board Template or Import Shared Config
          </div>
          <button
            type="button"
            className={styles['lumen-modal-close-btn'] || styles.lumenModalCloseBtn}
            onClick={handle_close}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles['lumen-template-import-bar'] || styles.lumenTemplateImportBar}>
          <div className={styles['lumen-template-import-info'] || styles.lumenTemplateImportInfo}>
            Have a shared board export (<code>.lumen-board.json</code>)? Load it directly as a new board:
          </div>
          <div className={styles['lumen-template-import-actions'] || styles.lumenTemplateImportActions}>
            <input
              ref={file_input_ref}
              type="file"
              accept=".json,application/json"
              onChange={handle_import_file}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className={styles['lumen-template-import-btn'] || styles.lumenTemplateImportBtn}
              onClick={() => file_input_ref.current?.click()}
            >
              <Upload size={13} />
              <span>Import Config (.json)</span>
            </button>
            <button
              type="button"
              className={styles['lumen-template-paste-btn'] || styles.lumenTemplatePasteBtn}
              onClick={() => set_show_paste_area((prev) => !prev)}
            >
              <FileCode size={13} />
              <span>{show_paste_area ? 'Hide Paste' : 'Paste Config JSON'}</span>
            </button>
          </div>
        </div>

        {show_paste_area && (
          <div className={styles['lumen-template-paste-panel'] || styles.lumenTemplatePastePanel}>
            <textarea
              rows={4}
              value={pasted_json}
              onChange={(e) => set_pasted_json(e.target.value)}
              placeholder='Paste exported board configuration JSON ({"format": "lumen_board_export", ...})'
              className={styles['lumen-template-paste-textarea'] || styles.lumenTemplatePasteTextarea}
            />
            <button
              type="button"
              className={styles['lumen-template-paste-submit'] || styles.lumenTemplatePasteSubmit}
              onClick={handle_create_from_paste}
            >
              Create Board from Shared Configuration
            </button>
          </div>
        )}

        <div className={styles['lumen-template-grid'] || styles.lumenTemplateGrid}>
          {template_list.map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              className={styles['lumen-template-card'] || styles.lumenTemplateCard}
              onClick={() => handle_select_template(tpl.key)}
            >
              <div className={styles['lumen-template-name'] || styles.lumenTemplateName}>
                {tpl.title}
              </div>
              <div className={styles['lumen-template-desc'] || styles.lumenTemplateDesc}>
                {tpl.description}
              </div>
              <div className={styles['lumen-template-badge-row'] || styles.lumenTemplateBadgeRow}>
                <span className={styles['lumen-template-badge'] || styles.lumenTemplateBadge}>
                  {tpl.type}
                </span>
                <span className={styles['lumen-template-meta-badge'] || styles.lumenTemplateMetaBadge}>
                  {tpl.card_count} cards{tpl.connection_count > 0 ? ` • ${tpl.connection_count} links` : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LUMEN_template_modal;
export { LUMEN_template_modal as TemplateModal };

