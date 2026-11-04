import { useSignals } from '@preact/signals-react/runtime';
import { X } from 'lucide-react';
import styles from './LUMEN_image_viewer_modal.module.css';
import {
  imageViewerSignal,
  closeImageViewer,
} from '../../signals/boardState.js';

export function LUMEN_image_viewer_modal() {
  useSignals();
  const viewer_state = imageViewerSignal.value;

  if (!viewer_state?.isOpen) return null;

  const current_slide = viewer_state.slides?.[viewer_state.activeIndex] || viewer_state.slides?.[0];
  const image_url = current_slide?.url || current_slide || '';

  return (
    <div
      className={styles['lumen-modal-backdrop'] || styles.lumenModalBackdrop}
      onClick={closeImageViewer}
    >
      <div
        className={styles['lumen-image-viewer-container'] || styles.lumenImageViewerContainer}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles['lumen-image-close-btn'] || styles.lumenImageCloseBtn}
          onClick={closeImageViewer}
          title="Close image viewer"
        >
          <X size={18} />
        </button>

        {image_url && (
          <img
            src={image_url}
            alt={viewer_state.title || 'Image Preview'}
            className={styles['lumen-image-preview'] || styles.lumenImagePreview}
            referrerPolicy="no-referrer"
            onError={(e) => {
              const topic_hint = encodeURIComponent(
                (viewer_state.title || 'Studio Product Photography').slice(0, 80)
              );
              const fallback_url = `/api/ai/card-image?topic=${topic_hint}`;
              if (e.currentTarget.src !== fallback_url && !e.currentTarget.dataset.retried) {
                e.currentTarget.dataset.retried = 'true';
                e.currentTarget.src = fallback_url;
              }
            }}
          />
        )}

        {viewer_state.title && (
          <div className={styles['lumen-image-title'] || styles.lumenImageTitle}>
            {viewer_state.title}
          </div>
        )}
      </div>
    </div>
  );
}

export default LUMEN_image_viewer_modal;
export { LUMEN_image_viewer_modal as ImageViewerModal };
