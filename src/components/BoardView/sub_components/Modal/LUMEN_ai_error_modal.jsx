import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSignals } from '@preact/signals-react/runtime';
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  Lock,
  Cpu,
  X,
  Activity,
  HelpCircle,
} from 'lucide-react';
import styles from './LUMEN_ai_error_modal.module.css';
import {
  aiErrorModalSignal,
  closeAiErrorModal,
} from '../../signals/aiState.js';
import { ai_usage_signal } from '../../signals/boardState.js';

function get_error_category_visuals(category) {
  switch (category) {
    case 'timeout':
      return {
        icon: Clock,
        badge_text: 'Request Timeout',
        theme_class: 'lumen-ai-error-theme-warn',
      };
    case 'quota_limit':
    case 'rate_limit':
      return {
        icon: Activity,
        badge_text: category === 'quota_limit' ? 'AI Usage Limit' : 'Rate Limit',
        theme_class: 'lumen-ai-error-theme-quota',
      };
    case 'security_block':
      return {
        icon: ShieldAlert,
        badge_text: 'Security Policy',
        theme_class: 'lumen-ai-error-theme-danger',
      };
    case 'access_denied':
      return {
        icon: Lock,
        badge_text: 'Access Restricted',
        theme_class: 'lumen-ai-error-theme-danger',
      };
    default:
      return {
        icon: AlertTriangle,
        badge_text: 'AI Query Error',
        theme_class: 'lumen-ai-error-theme-danger',
      };
  }
}

export function LUMEN_ai_error_modal() {
  useSignals();
  const modal_state = aiErrorModalSignal.value;
  const global_ai_usage = ai_usage_signal.value;

  useEffect(() => {
    if (!modal_state?.is_open) return undefined;
    const handle_key_down = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeAiErrorModal();
      }
    };
    window.addEventListener('keydown', handle_key_down, true);
    return () => window.removeEventListener('keydown', handle_key_down, true);
  }, [modal_state?.is_open]);

  if (!modal_state || !modal_state.is_open) return null;

  const visuals = get_error_category_visuals(modal_state.category);
  const IconComponent = visuals.icon;
  const usage_data = modal_state.usage_summary || (
    (modal_state.category === 'quota_limit' || modal_state.category === 'rate_limit')
      ? global_ai_usage
      : null
  );

  const format_num = (n) => Number(n || 0).toLocaleString();

  const modal_content = (
    <div
      className={styles['lumen-ai-error-backdrop'] || styles.lumenAiErrorBackdrop}
      onClick={closeAiErrorModal}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      data-lumen-menu="true"
    >
      <div
        className={styles['lumen-ai-error-window'] || styles.lumenAiErrorWindow}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lumen-ai-error-modal-title"
      >
        {/* Header */}
        <div className={styles['lumen-ai-error-header'] || styles.lumenAiErrorHeader}>
          <div className={styles['lumen-ai-error-header-left'] || styles.lumenAiErrorHeaderLeft}>
            <div
              className={`${styles['lumen-ai-error-icon-box'] || styles.lumenAiErrorIconBox} ${
                styles[visuals.theme_class] || ''
              }`}
            >
              <IconComponent size={18} />
            </div>
            <div className={styles['lumen-ai-error-title-wrap'] || styles.lumenAiErrorTitleWrap}>
              <div className={styles['lumen-ai-error-badge-row'] || styles.lumenAiErrorBadgeRow}>
                <span
                  className={`${styles['lumen-ai-error-badge'] || styles.lumenAiErrorBadge} ${
                    styles[visuals.theme_class] || ''
                  }`}
                >
                  {visuals.badge_text}
                </span>
                {modal_state.status_code ? (
                  <span className={styles['lumen-ai-error-code-pill'] || styles.lumenAiErrorCodePill}>
                    HTTP {modal_state.status_code}
                  </span>
                ) : null}
                {modal_state.reason_code ? (
                  <span className={styles['lumen-ai-error-code-pill'] || styles.lumenAiErrorCodePill}>
                    {modal_state.reason_code}
                  </span>
                ) : null}
              </div>
              <h3
                id="lumen-ai-error-modal-title"
                className={styles['lumen-ai-error-title'] || styles.lumenAiErrorTitle}
              >
                {modal_state.title || 'Unable to Complete AI Request'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            className={styles['lumen-ai-error-close-btn'] || styles.lumenAiErrorCloseBtn}
            onClick={closeAiErrorModal}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className={styles['lumen-ai-error-body'] || styles.lumenAiErrorBody}>
          {(modal_state.action_label || modal_state.model_label) && (
            <div className={styles['lumen-ai-error-meta-bar'] || styles.lumenAiErrorMetaBar}>
              {modal_state.action_label && (
                <div className={styles['lumen-ai-error-meta-item'] || styles.lumenAiErrorMetaItem}>
                  <span className={styles['lumen-ai-error-meta-label'] || styles.lumenAiErrorMetaLabel}>
                    Action:
                  </span>
                  <span className={styles['lumen-ai-error-meta-value'] || styles.lumenAiErrorMetaValue}>
                    {modal_state.action_label}
                  </span>
                </div>
              )}
              {modal_state.model_label && (
                <div className={styles['lumen-ai-error-meta-item'] || styles.lumenAiErrorMetaItem}>
                  <Cpu size={12} />
                  <span className={styles['lumen-ai-error-meta-value'] || styles.lumenAiErrorMetaValue}>
                    {modal_state.model_label}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className={styles['lumen-ai-error-message-box'] || styles.lumenAiErrorMessageBox}>
            <p className={styles['lumen-ai-error-message'] || styles.lumenAiErrorMessage}>
              {modal_state.message}
            </p>
            {modal_state.details && modal_state.details !== modal_state.message && (
              <p className={styles['lumen-ai-error-details'] || styles.lumenAiErrorDetails}>
                {modal_state.details}
              </p>
            )}
          </div>

          {/* Usage Quota Breakdown when limit is reached */}
          {usage_data && (
            <div className={styles['lumen-ai-error-quota-card'] || styles.lumenAiErrorQuotaCard}>
              <div className={styles['lumen-ai-error-quota-title'] || styles.lumenAiErrorQuotaTitle}>
                <Activity size={13} />
                <span>Current Account AI Usage ({usage_data.userAccount || 'Active User'})</span>
              </div>

              <div className={styles['lumen-ai-error-quota-grid'] || styles.lumenAiErrorQuotaGrid}>
                {usage_data.monthlyTokenLimit !== undefined && (
                  <div className={styles['lumen-ai-error-quota-metric'] || styles.lumenAiErrorQuotaMetric}>
                    <div className={styles['lumen-ai-error-quota-metric-top'] || styles.lumenAiErrorQuotaMetricTop}>
                      <span>Monthly Token Limit</span>
                      <strong>
                        {format_num(usage_data.monthlyTokensUsed)} / {format_num(usage_data.monthlyTokenLimit)}
                      </strong>
                    </div>
                    <div className={styles['lumen-ai-error-quota-bar-bg'] || styles.lumenAiErrorQuotaBarBg}>
                      <div
                        className={styles['lumen-ai-error-quota-bar-fill'] || styles.lumenAiErrorQuotaBarFill}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((Number(usage_data.monthlyTokensUsed) || 0) /
                                Math.max(1, Number(usage_data.monthlyTokenLimit) || 1)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {usage_data.dailyTokenLimit !== undefined && Number(usage_data.dailyTokenLimit) > 0 && (
                  <div className={styles['lumen-ai-error-quota-metric'] || styles.lumenAiErrorQuotaMetric}>
                    <div className={styles['lumen-ai-error-quota-metric-top'] || styles.lumenAiErrorQuotaMetricTop}>
                      <span>Daily Token Limit</span>
                      <strong>
                        {format_num(usage_data.dailyTokensUsed)} / {format_num(usage_data.dailyTokenLimit)}
                      </strong>
                    </div>
                    <div className={styles['lumen-ai-error-quota-bar-bg'] || styles.lumenAiErrorQuotaBarBg}>
                      <div
                        className={styles['lumen-ai-error-quota-bar-fill'] || styles.lumenAiErrorQuotaBarFill}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((Number(usage_data.dailyTokensUsed) || 0) /
                                Math.max(1, Number(usage_data.dailyTokenLimit) || 1)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {usage_data.dailyBurstLimit !== undefined && (
                  <div className={styles['lumen-ai-error-quota-metric'] || styles.lumenAiErrorQuotaMetric}>
                    <div className={styles['lumen-ai-error-quota-metric-top'] || styles.lumenAiErrorQuotaMetricTop}>
                      <span>Daily Request Burst</span>
                      <strong>
                        {format_num(usage_data.dailyRequestsUsed)} / {format_num(usage_data.dailyBurstLimit)} requests
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {modal_state.suggestion && (
            <div className={styles['lumen-ai-error-suggestion-box'] || styles.lumenAiErrorSuggestionBox}>
              <HelpCircle size={14} className={styles['lumen-ai-error-suggestion-icon'] || styles.lumenAiErrorSuggestionIcon} />
              <div className={styles['lumen-ai-error-suggestion-text'] || styles.lumenAiErrorSuggestionText}>
                <strong>How to resolve:</strong> {modal_state.suggestion}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles['lumen-ai-error-footer'] || styles.lumenAiErrorFooter}>
          <button
            type="button"
            className={styles['lumen-ai-error-primary-btn'] || styles.lumenAiErrorPrimaryBtn}
            onClick={closeAiErrorModal}
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modal_content, document.body);
  }
  return modal_content;
}

export default LUMEN_ai_error_modal;
