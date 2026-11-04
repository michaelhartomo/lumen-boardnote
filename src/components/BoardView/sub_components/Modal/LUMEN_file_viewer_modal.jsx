import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { FileText, Box, X, Download, Maximize2, Minimize2 } from 'lucide-react';
import loadable from '@loadable/component';
import styles from './LUMEN_file_viewer_modal.module.css';
import {
  fileViewerModalSignal,
  closeFileViewerModal,
  updateCard,
  saveCurrentBoardToStore,
} from '../../signals/boardState.js';

const LUMEN_3d_canvas_preview = loadable(() => import('../Card/LUMEN_3d_canvas_preview.jsx'), {
  fallback: (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '13px' }}>
      Loading 3D Character Studio...
    </div>
  ),
});

const LUMEN_pdf_canvas_viewer = loadable(() => import('../Card/LUMEN_pdf_canvas_viewer.jsx'), {
  fallback: (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '13px' }}>
      Loading PDF Reader...
    </div>
  ),
});

export function LUMEN_file_viewer_modal() {
  useSignals();
  const modal_state = fileViewerModalSignal.value;
  const modal_window_ref = useRef(null);
  const [is_fullscreen, set_is_fullscreen] = useState(true);

  const file_url = modal_state?.viewUrl || modal_state?.fileUrl || '';
  const file_data = modal_state?.fileData || '';
  const file_name = modal_state?.fileName || 'File Preview';
  const ext = (modal_state?.fileExtension || file_name.split('.').pop() || '').toLowerCase().replace('.', '');
  const is_3d_file =
    Boolean(modal_state?.is_3d) ||
    ['glb', 'gltf', 'obj', 'stl', '3ds', 'fbx', 'step', 'dae'].includes(ext) ||
    String(modal_state?.fileType || '').toLowerCase().includes('model') ||
    String(modal_state?.fileType || '').toLowerCase().includes('gltf');

  const is_pdf_file =
    ext === 'pdf' ||
    String(modal_state?.fileType || '').toLowerCase().includes('pdf') ||
    file_name.toLowerCase().endsWith('.pdf');

  const is_image_file =
    ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'bmp'].includes(ext) ||
    String(modal_state?.fileType || '').toLowerCase().startsWith('image/');

  useEffect(() => {
    if (modal_state?.isOpen) {
      set_is_fullscreen(
        is_pdf_file
          ? true
          : modal_state.is_fullscreen !== undefined
          ? Boolean(modal_state.is_fullscreen)
          : true
      );
    }
  }, [modal_state?.isOpen, modal_state?.is_fullscreen, is_pdf_file]);

  const handle_close_modal = async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      }
    } catch (_) {}
    closeFileViewerModal();
  };

  useEffect(() => {
    if (!modal_state?.isOpen || !is_pdf_file) return;
    const on_fs_change = () => {
      const fs_el = document.fullscreenElement || document.webkitFullscreenElement;
      if (!fs_el) {
        closeFileViewerModal();
      }
    };
    document.addEventListener('fullscreenchange', on_fs_change);
    document.addEventListener('webkitfullscreenchange', on_fs_change);
    return () => {
      document.removeEventListener('fullscreenchange', on_fs_change);
      document.removeEventListener('webkitfullscreenchange', on_fs_change);
    };
  }, [modal_state?.isOpen, is_pdf_file]);

  const handle_toggle_fullscreen = async () => {
    if (is_pdf_file) {
      await handle_close_modal();
      return;
    }

    const next_fs = !is_fullscreen;
    set_is_fullscreen(next_fs);

    const el = modal_window_ref.current;
    if (next_fs && el) {
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        }
      } catch (_) {}
    } else if (!next_fs) {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
      } catch (_) {}
    }
  };

  if (!modal_state?.isOpen) return null;

  const download_href = modal_state.fileUrl || file_url || file_data || '';

  return (
    <div
      className={`${styles['lumen-modal-backdrop'] || styles.lumenModalBackdrop} ${
        is_fullscreen ? styles['lumen-modal-backdrop-fullscreen'] : ''
      }`}
      onClick={handle_close_modal}
    >
      <div
        ref={modal_window_ref}
        className={`${styles['lumen-file-viewer-window'] || styles.lumenFileViewerWindow} ${
          is_fullscreen ? styles['lumen-file-viewer-window-fullscreen'] : ''
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {!is_pdf_file && (
          <div className={styles['lumen-file-viewer-header'] || styles.lumenFileViewerHeader}>
            <div className={styles['lumen-file-viewer-title'] || styles.lumenFileViewerTitle}>
              {is_3d_file ? (
                <Box size={16} color="var(--lumen-accent, #2563eb)" />
              ) : (
                <FileText size={16} color="var(--lumen-accent, #2563eb)" />
              )}
              <span>{file_name}</span>
            </div>

            <div className={styles['lumen-file-viewer-actions'] || styles.lumenFileViewerActions}>
              <button
                type="button"
                className={styles['lumen-file-viewer-btn'] || styles.lumenFileViewerBtn}
                onClick={handle_toggle_fullscreen}
                title={is_fullscreen ? 'Switch to Windowed View' : 'Switch to Full Screen View'}
              >
                {is_fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span>{is_fullscreen ? 'Windowed' : 'Full Screen'}</span>
              </button>

              {download_href && (
                <a
                  href={download_href}
                  download={file_name}
                  className={styles['lumen-file-viewer-btn'] || styles.lumenFileViewerBtn}
                >
                  <Download size={13} />
                  <span>Download</span>
                </a>
              )}
              <button
                type="button"
                className={styles['lumen-file-viewer-close-btn'] || styles.lumenFileViewerCloseBtn}
                onClick={handle_close_modal}
                title="Close viewer"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className={styles['lumen-file-viewer-body'] || styles.lumenFileViewerBody}>
          {is_3d_file ? (
            <LUMEN_3d_canvas_preview
              fileUrl={file_url}
              fileData={file_data}
              fileExtension={ext || 'glb'}
              fileName={file_name}
              mode="modal"
              initialAnimation={modal_state.active_animation || 'walk'}
              initialSkin={modal_state.character_skin || 'cyber'}
              customAnimations={modal_state.custom_animations || []}
              onAnimationChange={(anim_id) => {
                if (modal_state.cardId) {
                  updateCard(modal_state.cardId, { active_animation: anim_id }, false);
                  saveCurrentBoardToStore();
                }
              }}
              onSkinChange={(skin_id) => {
                if (modal_state.cardId) {
                  updateCard(modal_state.cardId, { character_skin: skin_id }, false);
                  saveCurrentBoardToStore();
                }
              }}
              onCustomAnimationsChange={(next_custom_anims) => {
                if (modal_state.cardId) {
                  updateCard(modal_state.cardId, { custom_animations: next_custom_anims }, false);
                  saveCurrentBoardToStore();
                }
              }}
            />
          ) : is_pdf_file ? (
            <LUMEN_pdf_canvas_viewer
              pdf_url={file_url}
              pdf_data={file_data}
              file_name={file_name}
              mode="modal"
              initial_page={modal_state.initial_page || 1}
              is_parent_fullscreen={is_fullscreen}
              on_toggle_parent_fullscreen={handle_toggle_fullscreen}
            />
          ) : is_image_file && (file_url || file_data) ? (
            <div className={styles['lumen-file-viewer-image-wrap']}>
              <img
                src={file_url || file_data}
                alt={file_name}
                className={styles['lumen-file-viewer-image']}
              />
            </div>
          ) : file_url ? (
            <iframe
              src={file_url}
              title={file_name}
              className={styles['lumen-file-viewer-frame'] || styles.lumenFileViewerFrame}
            />
          ) : (
            <div className={styles['lumen-file-viewer-empty']}>
              No preview available for this file.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LUMEN_file_viewer_modal;
export { LUMEN_file_viewer_modal as FileViewerModal };
