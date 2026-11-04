import { useSignals } from '@preact/signals-react/runtime';
import styles from './Toast.module.css';
import { toastMessageSignal } from '../../signals/boardState.js';

export function LUMEN_toast() {
  useSignals();
  const toast_text = toastMessageSignal.value;

  if (!toast_text) return null;

  return (
    <div className={styles['lumen-toast-container'] || styles.lumenToastContainer}>
      <div className={styles['lumen-toast'] || styles.lumenToast} role="status">
        <span className={styles['lumen-toast-dot'] || styles.lumenToastDot} />
        <span>{toast_text}</span>
      </div>
    </div>
  );
}

export default LUMEN_toast;
export { LUMEN_toast as Toast };
