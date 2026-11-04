import { useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Sparkles,
  Plus,
  Check,
  Image as ImageIcon,
  Edit2,
  X,
  ShoppingBag,
} from 'lucide-react';

import styles from './LUMEN_item_card.module.css';
import { updateCard, showToast } from '../../signals/boardState.js';

// Default architectural visual asset
import default_item_image from '../../assets/images/lumen_mood_arch_1791015833203.jpg';

export default function LUMEN_item_card({ card }) {
  useSignals();

  const [is_added_state, set_is_added_state] = useState(false);
  const [is_editing_url, set_is_editing_url] = useState(false);
  const [temp_url, set_temp_url] = useState('');
  const [is_editing_title, set_is_editing_title] = useState(false);
  const [is_editing_desc, set_is_editing_desc] = useState(false);
  const [is_editing_price, set_is_editing_price] = useState(false);

  const card_title = card.title || 'Premium Design';
  const card_desc =
    card.description !== undefined
      ? card.description
      : (card.content !== undefined && card.content !== ''
          ? card.content
          : 'Hover to reveal stunning effects');
  const card_price = card.price || card.data?.price || '$49.99';
  const card_category = card.category || card.data?.category || 'Product';
  const card_image = card.imageUrl || card.data?.imageUrl || card.image_url || default_item_image;

  const handle_add_click = (e) => {
    e.stopPropagation();
    set_is_added_state(true);
    showToast(`Added "${card_title}" to selection`);

    setTimeout(() => {
      set_is_added_state(false);
    }, 1800);
  };

  const handle_save_url = (e) => {
    e?.stopPropagation();
    if (temp_url.trim()) {
      updateCard(card.id, {
        imageUrl: temp_url.trim(),
        data: { ...(card.data || {}), imageUrl: temp_url.trim() },
      }, true);
    }
    set_is_editing_url(false);
  };

  return (
    <div
      className={styles['lumen-item-card-container'] || styles.lumenItemCardContainer}
      data-lumen-item-card="true"
    >
      {/* Visual Image Header */}
      <div className={styles['lumen-item-card-image-wrap'] || styles.lumenItemCardImageWrap}>
        {card_image ? (
          <img
            src={card_image}
            alt={card_title}
            className={styles['lumen-item-card-image'] || styles.lumenItemCardImage}
            loading="lazy"
          />
        ) : (
          <div className={styles['lumen-item-card-image-placeholder'] || styles.lumenItemCardImagePlaceholder}>
            <Sparkles size={32} className={styles['lumen-item-card-image-placeholder-icon'] || styles.lumenItemCardImagePlaceholderIcon} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>Preview</span>
          </div>
        )}

        {/* Category Badge Overlay */}
        <div className={styles['lumen-item-card-badge'] || styles.lumenItemCardBadge}>
          {card_category}
        </div>

        {/* Action Overlay */}
        <div className={styles['lumen-item-card-image-overlay-actions'] || styles.lumenItemCardImageOverlayActions}>
          <button
            type="button"
            className={styles['lumen-item-card-action-btn'] || styles.lumenItemCardActionBtn}
            onClick={(e) => {
              e.stopPropagation();
              set_temp_url(card.imageUrl || '');
              set_is_editing_url(true);
            }}
            title="Change image URL"
            aria-label="Change image URL"
          >
            <ImageIcon size={14} />
          </button>
        </div>

        {/* Inline URL Drawer */}
        {is_editing_url && (
          <div
            className={styles['lumen-item-card-url-drawer'] || styles.lumenItemCardUrlDrawer}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              className={styles['lumen-item-card-url-input'] || styles.lumenItemCardUrlInput}
              value={temp_url}
              onChange={(e) => set_temp_url(e.target.value)}
              placeholder="Paste image URL (https://...)"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handle_save_url(e);
                if (e.key === 'Escape') set_is_editing_url(false);
              }}
            />
            <button
              type="button"
              className={styles['lumen-item-card-url-save-btn'] || styles.lumenItemCardUrlSaveBtn}
              onClick={handle_save_url}
            >
              Set
            </button>
            <button
              type="button"
              className={styles['lumen-item-card-url-close-btn'] || styles.lumenItemCardUrlCloseBtn}
              onClick={() => set_is_editing_url(false)}
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Card Content Body */}
      <div className={styles['lumen-item-card-body'] || styles.lumenItemCardBody}>
        <div className={styles['lumen-item-card-text-group'] || styles.lumenItemCardTextGroup}>
          {/* Title */}
          {is_editing_title ? (
            <input
              type="text"
              className={styles['lumen-item-card-title-input'] || styles.lumenItemCardTitleInput}
              value={card.title || ''}
              autoFocus
              onChange={(e) => updateCard(card.id, { title: e.target.value }, false)}
              onBlur={() => {
                set_is_editing_title(false);
                updateCard(card.id, { title: card.title || '' }, true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  set_is_editing_title(false);
                  updateCard(card.id, { title: card.title || '' }, true);
                }
              }}
            />
          ) : (
            <h3
              className={styles['lumen-item-card-title'] || styles.lumenItemCardTitle}
              title="Double click or click to edit title"
              onClick={() => set_is_editing_title(true)}
            >
              {card_title}
            </h3>
          )}

          {/* Description */}
          {is_editing_desc ? (
            <textarea
              className={styles['lumen-item-card-description-input'] || styles.lumenItemCardDescriptionInput}
              value={card_desc}
              autoFocus
              onChange={(e) =>
                updateCard(card.id, {
                  description: e.target.value,
                  content: e.target.value,
                }, false)
              }
              onBlur={() => {
                set_is_editing_desc(false);
                updateCard(card.id, {
                  description: card.description || card_desc,
                  content: card.content || card_desc,
                }, true);
              }}
            />
          ) : (
            <p
              className={styles['lumen-item-card-description'] || styles.lumenItemCardDescription}
              title="Click to edit description"
              onClick={() => set_is_editing_desc(true)}
            >
              {card_desc}
            </p>
          )}
        </div>

        {/* Footer Row: Price & Add Button */}
        <div className={styles['lumen-item-card-footer'] || styles.lumenItemCardFooter}>
          <div className={styles['lumen-item-card-price-wrap'] || styles.lumenItemCardPriceWrap}>
            {is_editing_price ? (
              <input
                type="text"
                className={styles['lumen-item-card-price-input'] || styles.lumenItemCardPriceInput}
                value={card_price}
                autoFocus
                onChange={(e) =>
                  updateCard(card.id, {
                    price: e.target.value,
                    data: { ...(card.data || {}), price: e.target.value },
                  }, false)
                }
                onBlur={() => {
                  set_is_editing_price(false);
                  updateCard(card.id, {
                    price: card.price || card_price,
                    data: { ...(card.data || {}), price: card.price || card_price },
                  }, true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') set_is_editing_price(false);
                }}
              />
            ) : (
              <span
                className={styles['lumen-item-card-price'] || styles.lumenItemCardPrice}
                title="Click to edit price"
                onClick={() => set_is_editing_price(true)}
              >
                {card_price}
              </span>
            )}
            <span className={styles['lumen-item-card-price-tag'] || styles.lumenItemCardPriceTag}>
              USD
            </span>
          </div>

          {/* Add Button */}
          <button
            type="button"
            className={`${styles['lumen-item-card-add-btn'] || styles.lumenItemCardAddBtn} ${
              is_added_state
                ? (styles['lumen-item-card-add-btn-added'] || styles.lumenItemCardAddBtnAdded)
                : ''
            }`}
            onClick={handle_add_click}
            title={is_added_state ? 'Added!' : `Add ${card_title}`}
            aria-label={`Add ${card_title}`}
          >
            {is_added_state ? (
              <>
                <Check size={14} strokeWidth={2.8} />
                <span>Added</span>
              </>
            ) : (
              <>
                <Plus size={15} strokeWidth={2.5} />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
