import { useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { Download, X, FileText, Image, FileCode, Archive } from 'lucide-react';
import styles from './LUMEN_export_modal.module.css';
import {
  isExportModalOpenSignal,
  activeBoardSignal,
  showToast,
  downloadBoardConfigurationJson,
} from '../../signals/boardState.js';

export function LUMEN_export_modal({ on_export } = {}) {
  useSignals();
  const [is_exporting, set_is_exporting] = useState(false);
  const active_board = activeBoardSignal.value;

  const handle_close = () => {
    isExportModalOpenSignal.value = false;
  };

  const handle_do_export = async (type) => {
    set_is_exporting(true);
    try {
      if (type === 'json') {
        downloadBoardConfigurationJson(active_board);
      } else if (typeof on_export === 'function') {
        await on_export(type, active_board);
      } else {
        downloadBoardConfigurationJson(active_board);
      }
      handle_close();
    } catch (err) {
      console.error('Export error:', err);
      showToast('Export failed');
    } finally {
      set_is_exporting(false);
    }
  };

  const EXPORT_FORMATS = [
    { type: 'json', label: 'Board Config JSON', desc: 'Portable board configuration & template format (.json)', icon: FileCode },
    { type: 'pdf', label: 'PDF Document', desc: 'Vector multi-page document layout', icon: FileText },
    { type: 'png', label: 'PNG Image', desc: 'High-resolution raster snapshot', icon: Image },
    { type: 'zip', label: 'ZIP Bundle', desc: 'All board cards, images & manifest', icon: Archive },
  ];

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
            Export Workspace Board
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

        <div className={styles['lumen-export-options'] || styles.lumenExportOptions}>
          {EXPORT_FORMATS.map((fmt) => {
            const Icon = fmt.icon;
            return (
              <button
                key={fmt.type}
                type="button"
                className={styles['lumen-export-card'] || styles.lumenExportCard}
                onClick={() => handle_do_export(fmt.type)}
                disabled={is_exporting}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon size={16} color="var(--lumen-accent, #2563eb)" />
                  <span className={styles['lumen-export-name'] || styles.lumenExportName}>
                    {fmt.label}
                  </span>
                </div>
                <div className={styles['lumen-export-desc'] || styles.lumenExportDesc}>
                  {fmt.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default LUMEN_export_modal;
export { LUMEN_export_modal as ExportModal };
