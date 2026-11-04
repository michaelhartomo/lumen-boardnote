import { useState, useRef, useEffect } from 'react';
import {
  Download,
  Upload,
  Eye,
  FileText,
  Archive,
  Image as ImageIcon,
  Code,
  Music,
  Film,
  Table,
  File,
  HardDriveDownload,
  Clock,
  Sparkles,
  Maximize2,
  Box,
} from 'lucide-react';

import styles from './LUMEN_file_card.module.css';
import loadable from '@loadable/component';

const LUMEN_3d_canvas_preview = loadable(() => import('./LUMEN_3d_canvas_preview.jsx'), {
  fallback: (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--lumen-text-secondary)', fontSize: '12px' }}>
      Loading 3D preview...
    </div>
  ),
});

const LUMEN_pdf_canvas_viewer = loadable(() => import('./LUMEN_pdf_canvas_viewer.jsx'), {
  fallback: (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--lumen-text-secondary)', fontSize: '12px' }}>
      Loading PDF preview...
    </div>
  ),
});

import {
  activeBoardSignal,
  get_lumen_auth_headers,
  upload_lumen_file,
  MAX_BOARD_FILE_SIZE_MB,
  MAX_BOARD_FILE_SIZE_BYTES,
  updateCard,
  saveCurrentBoardToStore,
  showToast,
  openFileViewerModal,
  resolve_card_style,
} from '../../signals/boardState.js';

export function format_file_size(bytes) {
  if (!bytes || isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function get_file_visuals(ext) {
  const e = (ext || '').toLowerCase().replace('.', '');
  if (['glb', 'gltf', 'obj', 'stl', '3ds', 'fbx', 'step', 'dae'].includes(e)) {
    return { icon: Box, color: '#0284c7', bg: '#f0f9ff', label: '3D' };
  }
  if (['pdf'].includes(e)) {
    return { icon: FileText, color: '#dc2626', bg: '#fef2f2', label: 'PDF' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) {
    return { icon: Archive, color: '#d97706', bg: '#fffbeb', label: 'ZIP' };
  }
  if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'bmp'].includes(e)) {
    return { icon: ImageIcon, color: '#2563eb', bg: '#eff6ff', label: e.toUpperCase() };
  }
  if (['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'py', 'sh', 'md'].includes(e)) {
    return { icon: Code, color: '#7c3aed', bg: '#f5f3ff', label: e.toUpperCase() };
  }
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(e)) {
    return { icon: Music, color: '#059669', bg: '#ecfdf5', label: 'AUDIO' };
  }
  if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(e)) {
    return { icon: Film, color: '#e11d48', bg: '#fff1f2', label: 'VIDEO' };
  }
  if (['csv', 'xlsx', 'xls', 'tsv'].includes(e)) {
    return { icon: Table, color: '#16a34a', bg: '#f0fdf4', label: 'SHEET' };
  }
  if (['doc', 'docx', 'txt', 'rtf'].includes(e)) {
    return { icon: FileText, color: '#0284c7', bg: '#f0f9ff', label: 'DOC' };
  }
  return { icon: File, color: '#475569', bg: '#f8fafc', label: e ? e.toUpperCase() : 'FILE' };
}

export default function LUMEN_file_card({ card }) {
  const [is_dragging_over, set_is_dragging_over] = useState(false);
  const [is_uploading, set_is_uploading] = useState(false);
  const [upload_progress, set_upload_progress] = useState(0);
  const file_input_ref = useRef(null);
  const pdf_viewer_ref = useRef(null);

  const file_name = card.file_name || card.title || 'Attached_File';
  const file_ext = (card.file_extension || file_name.split('.').pop() || 'file').toLowerCase();
  const visuals = get_file_visuals(file_ext);
  const IconComponent = visuals.icon;

  const is_3d =
    ['glb', 'gltf', 'obj', 'stl', '3ds', 'fbx', 'step', 'dae'].includes(file_ext) ||
    card.file_type?.toLowerCase().includes('model') ||
    card.file_type?.toLowerCase().includes('3d') ||
    card.file_type?.toLowerCase().includes('gltf') ||
    card.is_3d;

  const is_pdf =
    file_ext === 'pdf' ||
    card.file_type?.toLowerCase().includes('pdf') ||
    file_name.toLowerCase().endsWith('.pdf');

  const [view_mode, set_view_mode] = useState(
    is_3d ? '3d' : is_pdf ? 'pdf' : 'info'
  ); // '3d' | 'pdf' | 'info'

  useEffect(() => {
    if (is_3d && view_mode !== '3d' && view_mode !== 'info') {
      set_view_mode('3d');
    } else if (is_pdf && view_mode !== 'pdf' && view_mode !== 'info') {
      set_view_mode('pdf');
    } else if (is_pdf && view_mode === 'info' && (card.file_id || card.file_url || card.view_url || card.file_data)) {
      set_view_mode('pdf');
    }
  }, [is_3d, is_pdf, card.file_id]);

  const has_file = Boolean(
    is_3d ||
    card.file_data ||
    (card.file_url && !card.file_url.includes('file_seed_guidelines_pdf')) ||
    (card.file_id && card.file_id !== 'file_seed_guidelines_pdf' && !card.file_id.includes('default')) ||
    (card.file_name && card.file_size)
  );

  const download_count = card.download_count || 0;
  const file_url = card.file_url || (card.file_id ? `/api/files/download/${card.file_id}` : null);
  const view_url = card.view_url || (card.file_id ? `/api/files/view/${card.file_id}` : file_url);

  // Download Handler
  const handle_download = (e) => {
    e.stopPropagation();
    if (!file_url && !card.file_data && !card.file_id?.includes('file_seed_model_pavilion')) {
      showToast('Upload a file first to download');
      return;
    }

    const new_count = download_count + 1;
    updateCard(card.id, { download_count: new_count }, false);
    saveCurrentBoardToStore();

    showToast(`Downloading ${file_name}...`);

    const link = document.createElement('a');
    link.href = file_url || card.file_data || `/api/files/download/${card.file_id}`;
    link.download = file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Full Viewer Modal (for 3D Studio & non-PDF files)
  const handle_open_modal = (e, extra_options = {}) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    openFileViewerModal({
      cardId: card.id,
      fileName: file_name,
      fileType: card.file_type || (is_3d ? 'model/gltf-binary' : is_pdf ? 'application/pdf' : file_ext),
      fileUrl: file_url,
      viewUrl: view_url,
      fileSize: card.file_size || 0,
      fileExtension: is_3d && file_ext === 'file' ? 'glb' : is_pdf ? 'pdf' : file_ext,
      fileData: card.file_data,
      is_3d: Boolean(is_3d),
      active_animation: card.active_animation || (card.file_data || card.file_id ? 'none' : 'walk'),
      character_skin: card.character_skin || 'cyber',
      custom_animations: card.custom_animations || [],
      content: card.content || '',
      is_fullscreen: extra_options.is_fullscreen !== undefined ? extra_options.is_fullscreen : true,
      initial_page: extra_options.initial_page || 1,
    });
  };

  // Trigger True Full Screen directly on the inline PDF viewer without opening a popup modal
  const handle_open_pdf_fullscreen = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (view_mode !== 'pdf') {
      set_view_mode('pdf');
      setTimeout(() => {
        if (pdf_viewer_ref.current?.enter_fullscreen) {
          pdf_viewer_ref.current.enter_fullscreen();
        }
      }, 60);
    } else if (pdf_viewer_ref.current?.enter_fullscreen) {
      pdf_viewer_ref.current.enter_fullscreen(e);
    }
  };

  // Upload or Replace File (up to 88MB for Cloudflare CDN caching)
  const handle_upload_file = async (file) => {
    if (!file) return;

    if (file.size > MAX_BOARD_FILE_SIZE_BYTES) {
      const size_mb_str = (file.size / (1024 * 1024)).toFixed(1);
      showToast(`File "${file.name}" (${size_mb_str} MB) exceeds the ${MAX_BOARD_FILE_SIZE_MB} MB upload limit`);
      return;
    }

    set_is_uploading(true);
    set_upload_progress(0);
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const is_new_file_3d = ['glb', 'gltf', 'obj', 'stl', '3ds', 'fbx', 'step', 'dae'].includes(ext);
      const is_new_file_pdf = ext === 'pdf' || file.type?.toLowerCase().includes('pdf');
      const mime_type =
        file.type ||
        (is_new_file_3d
          ? 'model/gltf-binary'
          : is_new_file_pdf
          ? 'application/pdf'
          : 'application/octet-stream');
      const current_board_id = activeBoardSignal.value?.id || activeBoardSignal.value?.board_code;

      const res_data = await upload_lumen_file(file, {
        boardId: current_board_id,
        cardId: card.id,
        mimeType: mime_type,
        onProgress: (pct) => set_upload_progress(pct),
      });

      const resolved_file_code = res_data.file_storage_code || res_data.fileId;
      const update_payload = {
        title: file.name,
        file_name: file.name,
        file_id: resolved_file_code,
        file_storage_code: resolved_file_code,
        file_size: file.size,
        file_type: mime_type,
        file_url: res_data.fileUrl,
        view_url: res_data.viewUrl,
        s3_key: res_data.s3Key,
        file_extension: ext,
        file_data: null,
        uploaded_at: Date.now(),
        active_animation: 'none',
        custom_animations: [],
      };

      // If uploading a 3D model or PDF into a smaller card, ensure comfortable viewing dimensions
      if ((is_new_file_3d || is_new_file_pdf) && (!card.height || card.height < 380)) {
        update_payload.height = 440;
        update_payload.width = Math.max(card.width || 340, 360);
      }

      updateCard(card.id, update_payload, true);
      saveCurrentBoardToStore();
      if (is_new_file_3d) {
        set_view_mode('3d');
      } else if (is_new_file_pdf) {
        set_view_mode('pdf');
      }

      if (res_data.storage) {
        showToast(`Uploaded to Spaces (${res_data.storage.used_gb} / ${res_data.storage.limit_gb} GB used)`);
      } else {
        showToast(`Uploaded ${file.name} successfully`);
      }
    } catch (upload_err) {
      console.error('Server upload failed:', upload_err);
      showToast(upload_err.message || 'File upload failed');
    } finally {
      set_is_uploading(false);
      set_upload_progress(0);
    }
  };

  const handle_input_change = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handle_upload_file(file);
    }
    e.target.value = '';
  };

  // Drag and drop handlers on card
  const handle_drag_over = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!is_dragging_over) {
      set_is_dragging_over(true);
    }
  };

  const handle_drag_leave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.relatedTarget instanceof Node && e.currentTarget?.contains(e.relatedTarget)) {
      return;
    }
    set_is_dragging_over(false);
  };

  const handle_drop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    set_is_dragging_over(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handle_upload_file(file);
    }
  };

  const uploaded_date_str = card.uploaded_at
    ? new Date(card.uploaded_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : 'Recent';

  const is_seamless = resolve_card_style(card, activeBoardSignal.value) === 'seamless';

  return (
    <div
      className={`${styles['lumen-file-card-container']} ${
        is_seamless && has_file
          ? styles['lumen-file-card-seamless']
          : ''
      }`}
      onDragOver={handle_drag_over}
      onDragLeave={handle_drag_leave}
      onDrop={handle_drop}
    >
      <input
        ref={file_input_ref}
        type="file"
        style={{ display: 'none' }}
        onChange={handle_input_change}
      />

      {/* Main Content: Upload Info Prompt if no file, or Attached File View */}
      {!has_file ? (
        <div className={styles['lumen-file-empty-state']}>
          <div className={styles['lumen-file-header']}>
            <div className={styles['lumen-file-meta-wrap']}>
              <input
                type="text"
                className={styles['lumen-file-name-input']}
                value={card.title || 'File Attachment'}
                onChange={(e) => updateCard(card.id, { title: e.target.value }, false)}
                onBlur={() => saveCurrentBoardToStore()}
                placeholder="Card title (optional)"
              />
            </div>
          </div>

          <div
            className={styles['lumen-file-upload-prompt']}
            onClick={(e) => {
              e.stopPropagation();
              file_input_ref.current?.click();
            }}
            title="Click or drag file here to upload"
          >
            <div className={styles['lumen-file-upload-icon-circle']}>
              <Upload size={22} />
            </div>
            <div className={styles['lumen-file-upload-prompt-title']}>
              Upload a File
            </div>
            <div className={styles['lumen-file-upload-prompt-desc']}>
              Drag & drop a file here, or click to browse
            </div>
            <div className={styles['lumen-file-upload-specs']}>
              Supports 3D models (GLB, OBJ), PDF, images, docs, audio, video & archives (up to 88MB)
            </div>
            <button
              type="button"
              className={styles['lumen-file-upload-browse-btn']}
              onClick={(e) => {
                e.stopPropagation();
                file_input_ref.current?.click();
              }}
            >
              <Upload size={12} />
              <span>Browse Files</span>
            </button>
          </div>

          <textarea
            className={styles['lumen-file-description']}
            value={card.content || ''}
            onChange={(e) => updateCard(card.id, { content: e.target.value }, false)}
            onBlur={() => saveCurrentBoardToStore()}
            placeholder="Add notes or file instructions (optional)..."
            rows={2}
          />
        </div>
      ) : (
        <>
          {/* Header Info - Hidden in Seamless Mode when viewing 3D or PDF */}
          {(!is_seamless || (!is_3d && !is_pdf)) && (
            <div className={styles['lumen-file-header']}>
              <div
                className={styles['lumen-file-icon-box']}
                style={{ backgroundColor: visuals.bg, color: visuals.color }}
                onClick={is_pdf ? handle_open_pdf_fullscreen : handle_open_modal}
                title={is_pdf ? 'Click to open PDF in Full Screen' : 'Click to view file in studio modal'}
              >
                <IconComponent size={20} />
                <span className={styles['lumen-file-ext-badge']}>{visuals.label}</span>
              </div>

              <div className={styles['lumen-file-meta-wrap']}>
                <input
                  type="text"
                  className={styles['lumen-file-name-input']}
                  value={card.title || file_name}
                  onChange={(e) => updateCard(card.id, { title: e.target.value, file_name: e.target.value }, false)}
                  onBlur={() => saveCurrentBoardToStore()}
                  placeholder="File name"
                  title="Click to rename"
                />

                <div className={styles['lumen-file-badges-row']}>
                  <span className={styles['lumen-file-pill']}>
                    {format_file_size(card.file_size || 0)}
                  </span>
                  <span className={styles['lumen-file-pill']}>
                    <Clock size={10} />
                    {uploaded_date_str}
                  </span>
                  {download_count > 0 && (
                    <span className={styles['lumen-file-pill']} title="Total downloads">
                      <HardDriveDownload size={10} />
                      {download_count} {download_count === 1 ? 'dl' : 'dls'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3D & PDF Mode Switcher Tabs - Hidden in Seamless Mode */}
          {!is_seamless && (is_3d || is_pdf) && (
            <div className={styles['lumen-file-view-tabs']}>
              {is_3d && (
                <button
                  type="button"
                  className={`${styles['lumen-file-view-tab']} ${
                    view_mode === '3d' ? styles['lumen-file-view-tab-active'] : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    set_view_mode('3d');
                  }}
                >
                  <Box size={11} />
                  <span>3D View</span>
                </button>
              )}

              {is_pdf && (
                <button
                  type="button"
                  className={`${styles['lumen-file-view-tab']} ${
                    view_mode === 'pdf' ? styles['lumen-file-view-tab-active'] : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    set_view_mode('pdf');
                  }}
                >
                  <Eye size={11} />
                  <span>PDF Preview</span>
                </button>
              )}

              <button
                type="button"
                className={`${styles['lumen-file-view-tab']} ${
                  view_mode === 'info' ? styles['lumen-file-view-tab-active'] : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  set_view_mode('info');
                }}
              >
                <FileText size={11} />
                <span>Info & Notes</span>
              </button>
            </div>
          )}

          {/* Main View Area: Interactive 3D Canvas, Inline PDF Viewer, OR File Info Dropzone */}
          {is_3d && (view_mode === '3d' || is_seamless) ? (
            <div
              className={styles['lumen-file-3d-preview-wrap']}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <LUMEN_3d_canvas_preview
                fileUrl={view_url || file_url}
                fileData={card.file_data}
                fileExtension={file_ext === 'file' ? 'glb' : file_ext}
                fileName={file_name}
                mode="card"
                is_seamless={is_seamless}
                initialAnimation={card.active_animation || (card.file_data || card.file_id ? 'none' : 'walk')}
                initialSkin={card.character_skin || 'cyber'}
                customAnimations={card.custom_animations || []}
                onAnimationChange={(anim_id) => {
                  updateCard(card.id, { active_animation: anim_id }, false);
                  saveCurrentBoardToStore();
                }}
                onSkinChange={(skin_id) => {
                  updateCard(card.id, { character_skin: skin_id }, false);
                  saveCurrentBoardToStore();
                }}
                onCustomAnimationsChange={(next_custom_anims) => {
                  updateCard(card.id, { custom_animations: next_custom_anims }, false);
                  saveCurrentBoardToStore();
                }}
                onUploadFile={handle_upload_file}
                onOpenModal={handle_open_modal}
              />
            </div>
          ) : is_pdf && (view_mode === 'pdf' || is_seamless) ? (
            <div
              className={styles['lumen-file-3d-preview-wrap']}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <LUMEN_pdf_canvas_viewer
                pdf_url={view_url || file_url}
                pdf_data={card.file_data}
                file_name={file_name}
                mode="card"
                is_seamless={is_seamless}
                viewer_ref={pdf_viewer_ref}
                on_open_modal={handle_open_modal}
              />
            </div>
          ) : (
            <>
              {/* Upload Button & Drag-and-Drop Zone - Hidden in Seamless Mode */}
              {!is_seamless && (
                <div
                  className={styles['lumen-file-dropzone']}
                  onClick={(e) => {
                    e.stopPropagation();
                    file_input_ref.current?.click();
                  }}
                  title="Click or drag file here to upload"
                >
                  <span className={styles['lumen-file-dropzone-icon']}>
                    <Upload size={15} />
                  </span>
                  <span className={styles['lumen-file-dropzone-text']}>
                    <span>Drag & drop file or</span>
                    <span className={styles['lumen-file-dropzone-browse']}>browse</span>
                  </span>
                </div>
              )}

              {/* Notes / Context Description */}
              <textarea
                className={styles['lumen-file-description']}
                value={card.content || ''}
                onChange={(e) => updateCard(card.id, { content: e.target.value }, false)}
                onBlur={() => saveCurrentBoardToStore()}
                placeholder="Add file description or team notes..."
                rows={2}
              />
            </>
          )}

          {/* Action Buttons Row - Hidden in Seamless Mode */}
          {!is_seamless && (
            <div className={styles['lumen-file-actions']}>
              <button
                type="button"
                className={styles['lumen-file-download-btn']}
                onClick={handle_download}
                title={`Download ${file_name}`}
              >
                <Download size={13} />
                <span>Download</span>
                {card.file_size ? (
                  <span className={styles['lumen-file-size-tag']}>({format_file_size(card.file_size)})</span>
                ) : null}
              </button>

              <button
                type="button"
                className={styles['lumen-file-sec-btn']}
                onClick={(e) => {
                  if (is_pdf) {
                    handle_open_pdf_fullscreen(e);
                  } else {
                    handle_open_modal(e, { is_fullscreen: true });
                  }
                }}
                title={
                  is_3d
                    ? 'Open in 3D Studio inspection modal'
                    : 'Open in True Full Screen Viewer'
                }
              >
                <Maximize2 size={12} />
                <span>{is_3d ? '3D Studio' : is_pdf ? 'Full Screen' : 'Viewer'}</span>
              </button>

              <button
                type="button"
                className={styles['lumen-file-sec-btn']}
                onClick={(e) => {
                  e.stopPropagation();
                  file_input_ref.current?.click();
                }}
                title="Upload / Replace with new file"
              >
                <Upload size={12} />
                <span>Replace</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Drag Over Dropzone State */}
      {is_dragging_over && (
        <div className={styles['lumen-file-dropzone-active']}>
          <Upload size={24} />
          <span>Drop file to upload</span>
        </div>
      )}

      {/* Uploading Spinner Overlay */}
      {is_uploading && (
        <div className={styles['lumen-file-uploading-overlay']}>
          <Sparkles size={20} color="#2563eb" className="animate-spin" />
          <span>
            Uploading file to board... {upload_progress > 0 ? `${upload_progress}%` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

