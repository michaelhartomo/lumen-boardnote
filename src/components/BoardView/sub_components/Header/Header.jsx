import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSignals } from '@preact/signals-react/runtime';
import { useNavigate } from 'react-router';
import {
  ZoomIn,
  ZoomOut,
  Minus,
  Plus,
  LayoutTemplate,
  ChevronDown,
  Sparkles,
  ArrowLeft,
  ChevronRight,
  FolderKanban,
  Sliders,
  Boxes,
  MoreHorizontal,
  Menu,
  X,
  Layers,
  Settings,
  Grid,
  Check,
  History,
  Share2,
  Lock,
  Globe,
} from 'lucide-react';

import styles from './Header.module.css';
import LUMEN_zoom_popup from '../Zoom/LUMEN_zoom_popup.jsx';
import LUMEN_user_avatar from '../Common/LUMEN_user_avatar.jsx';
import {
  activeBoardSignal,
  boardsDirectorySignal,
  fetchBoardsFromServer,
  updateViewport,
  createNewBoard,
  setActiveBoard,
  isTemplateModalOpenSignal,
  getBoardAncestors,
  isPropertyPanelOpenSignal,
  togglePropertyPanel,
  selectedCardsSignal,
  createGroupCard,
  toggleLayerPanel,
  toggleBoardSettingsPanel,
  snapToGridSignal,
  gridDimensionSignal,
  isAutoOpenPropertyEnabledSignal,
  toggleAutoOpenProperty,
  showToast,
  openShareModal,
  isShareModalOpenSignal,
  normalize_board_sharing,
} from '../../signals/boardState.js';
import {
  toggleAiPanel,
} from '../../signals/aiState.js';
import {
  currentUserSignal,
  activeUsersSignal,
  isWsConnectedSignal,
  switchUserProfile,
  COLLABORATOR_PROFILES,
  isActivityDrawerOpenSignal,
  toggleActivityDrawer,
  activityLogsSignal,
  lumenAuthSignal,
} from '../../signals/realtimeState.js';

export default function Header({
  auth,
  on_create_board,
  on_save,
  on_navigate_board,
  read_only = false,
} = {}) {
  useSignals();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isZoomPopupOpen, setIsZoomPopupOpen] = useState(false);
  const menuRef = useRef(null);
  const userMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const mobileZoomRef = useRef(null);


  const activeBoard = activeBoardSignal.value;
  const rawBoardsList = boardsDirectorySignal.value || [];

  const currentUser = currentUserSignal.value;
  const collaborators = activeUsersSignal.value;
  const isWsConnected = isWsConnectedSignal.value;

  // LUMEN Auth System User Resolution
  const effective_auth = auth !== undefined ? auth : lumenAuthSignal.value;
  const has_user_account = Boolean(effective_auth?.user_account && String(effective_auth.user_account).trim());
  const owner_user_account = has_user_account ? String(effective_auth.user_account).trim() : null;
  const boardsList = owner_user_account
    ? rawBoardsList.filter((b) => b && b.user_account === owner_user_account)
    : [];
  const has_user_full_name = Boolean(effective_auth?.user_full_name && String(effective_auth.user_full_name).trim());
  const has_user_avatar = Boolean(effective_auth?.user_avatar && String(effective_auth.user_avatar).trim());
  const has_user_status = Boolean(effective_auth?.user_status && String(effective_auth.user_status).trim());
  const is_guest = !has_user_account && !has_user_full_name;

  const display_full_name = has_user_full_name
    ? String(effective_auth.user_full_name).trim()
    : (has_user_account ? String(effective_auth.user_account).trim() : (currentUser?.name || 'Guest User'));

  const display_first_name = has_user_full_name
    ? String(effective_auth.user_full_name).trim().split(/\s+/)[0]
    : (has_user_account ? String(effective_auth.user_account).trim() : (currentUser?.name ? currentUser.name.split(' ')[0] : 'Guest'));

  const ancestors = activeBoard?.id ? getBoardAncestors(activeBoard.id) : [];

  const currentZoom = activeBoard?.viewport?.zoom || 1;
  const zoomPercent = Math.round(currentZoom * 100);

  // Close board dropdown or user switcher on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
      if (userMenuRef.current && e.target instanceof Node && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
      if (mobileMenuRef.current && e.target instanceof Node && !mobileMenuRef.current.contains(e.target)) {
        setIsMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    fetchBoardsFromServer();
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleZoomTo = (targetZoom) => {
    if (!activeBoard) return;
    const clampedZoom = Math.min(2.0, Math.max(0.3, Number(targetZoom.toFixed(2))));
    const viewport = activeBoard?.viewport || { panX: 0, panY: 0, zoom: 1 };
    const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
    const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 400;
    const oldZoom = viewport.zoom || 1;
    const newPanX = centerX - (centerX - viewport.panX) * (clampedZoom / oldZoom);
    const newPanY = centerY - (centerY - viewport.panY) * (clampedZoom / oldZoom);
    updateViewport(newPanX, newPanY, clampedZoom);
  };

  const handleZoomChange = (delta) => {
    handleZoomTo(currentZoom + delta);
  };

  const handleResetZoom = () => {
    handleZoomTo(1);
  };

  const handleSwitchBoard = (id) => {
    setIsMenuOpen(false);
    setIsMobileMenuOpen(false);
    if (!id) {
      handleNavigateAllBoards();
      return;
    }
    setActiveBoard(id);
    if (typeof on_navigate_board === 'function') {
      on_navigate_board(id);
    } else {
      navigate(`/board/${id}`);
    }
  };

  const handleNavigateAllBoards = () => {
    setIsMenuOpen(false);
    setIsMobileMenuOpen(false);
    setActiveBoard(null);
    if (typeof on_navigate_board === 'function') {
      on_navigate_board(null);
    } else {
      navigate('/boards');
    }
  };

  const handleCreateNew = async (type = 'snap_grid') => {
    setIsMenuOpen(false);
    setIsMobileMenuOpen(false);
    const title = 'New Board';

    // Create the new board (persists immediately to server and updates activeBoardSignal)
    const newId = createNewBoard(title, type);

    // Navigate cleanly to the newly created board
    if (typeof on_navigate_board === 'function') {
      on_navigate_board(newId);
    } else {
      navigate(`/board/${newId}`);
    }
  };


  return (
    <header className={styles.lumenHeader}>
      {/* Zone 1: Wordmark & Board Switcher / Breadcrumbs */}
      <div className={styles.lumenBrandZone}>
        {/* If inside an active board, show "Boards" button to return to board list */}
        {activeBoard?.id ? (
          <div className={styles.lumenBreadcrumbs}>
            <button
              type="button"
              className={styles.lumenBreadcrumbLink}
              onClick={handleNavigateAllBoards}
              title="Return to Workspace Boards List"
            >
              <FolderKanban size={13} className={styles.lumenBreadcrumbIcon} />
              <span>Boards</span>
            </button>
            <ChevronRight size={12} className={styles.lumenBreadcrumbSep} />

            {/* Back Button if in Nested Sub-Board */}
            {ancestors.length > 0 && (
              <button
                type="button"
                className={styles.lumenBackParentBtn}
                onClick={() => handleSwitchBoard(ancestors[ancestors.length - 1].id)}
                title={`Back to parent: ${ancestors[ancestors.length - 1].title}`}
              >
                <ArrowLeft size={13} />
                <span>Back</span>
              </button>
            )}

            {/* Breadcrumb Trail for Multi-Nested Boards */}
            {ancestors.length > 0 && (
              <>
                {ancestors.map((anc) => (
                  <div key={anc.id} className={styles.lumenBreadcrumbItem}>
                    <button
                      type="button"
                      className={styles.lumenBreadcrumbLink}
                      onClick={() => handleSwitchBoard(anc.id)}
                      title={`Navigate to ${anc.title}`}
                    >
                      <span>{anc.title}</span>
                    </button>
                    <ChevronRight size={12} className={styles.lumenBreadcrumbSep} />
                  </div>
                ))}
              </>
            )}
          </div>
        ) : null}

        <div className={styles.lumenBoardSelector} ref={menuRef}>
          <button
            type="button"
            className={styles.lumenBoardButton}
            onClick={() => {
              const next_open = !isMenuOpen;
              setIsMenuOpen(next_open);
              if (next_open) {
                fetchBoardsFromServer();
              }
            }}
            title="Switch Workspace Board"
          >
            <span className={styles.lumenBoardTitleText}>{activeBoard?.title || 'Workspace Boards'}</span>
            <ChevronDown size={14} />
          </button>

          {isMenuOpen && (
            <div className={styles.lumenBoardMenu} onMouseDown={(e) => e.stopPropagation()}>
              <div className={styles.lumenBoardMenuHeader}>Workspace Boards</div>
              <button
                type="button"
                className={`${styles.lumenBoardMenuItem} ${
                  !activeBoard?.id ? styles.lumenBoardMenuItemActive : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigateAllBoards();
                }}
                title="View All Boards Directory"
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: !activeBoard?.id ? 600 : 500 }}>
                  <FolderKanban size={14} color="var(--lumen-accent)" />
                  <span>All Boards Directory</span>
                </span>
                {!activeBoard?.id && <Check size={14} color="var(--lumen-accent)" />}
              </button>
              <div style={{ margin: '4px 0', borderTop: '1px solid var(--lumen-border)' }} />
              {boardsList.map((b) => {
                const bType = b.boardType || (b.id === 'board_blank' ? 'free_position' : 'snap_grid');
                const isNested = Boolean(b.is_nested || b.parent_board_id);
                const isActive = b.id === activeBoard?.id;
                return (
                  <button
                    type="button"
                    key={b.id}
                    className={`${styles.lumenBoardMenuItem} ${
                      isActive ? styles.lumenBoardMenuItemActive : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSwitchBoard(b.id);
                    }}
                    style={isNested ? { paddingLeft: 16 } : {}}
                  >
                    <span>{b.title}</span>
                    <div className={styles.lumenBoardItemMeta}>
                      {isNested && (
                        <span
                          className={`${styles.lumenBoardTypeBadge} ${styles.lumenBoardTypeBadgeNested}`}
                          title="Nested sub-board"
                        >
                          Sub
                        </span>
                      )}
                      <span
                        className={`${styles.lumenBoardTypeBadge} ${
                          bType === 'free_position'
                            ? styles.lumenBoardTypeBadgeFree
                            : styles.lumenBoardTypeBadgeGrid
                        }`}
                      >
                        {bType === 'free_position' ? 'Free' : 'Grid'}
                      </span>
                      <span className={styles.lumenBoardItemCount}>
                        {isActive ? (activeBoard?.cards?.length || 0) : b.cardCount} cards
                      </span>
                    </div>
                  </button>
                );
              })}
              <div style={{ margin: '4px 0', borderTop: '1px solid var(--lumen-border)' }} />
              <button
                type="button"
                className={styles.lumenBoardMenuItem}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateNew('snap_grid');
                }}
                title="Create a new workspace board (Snap to Grid)"
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--lumen-accent)', fontWeight: 600 }}>
                  <Plus size={14} />
                  <span>New Board</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Collaborators Presence Strip */}
      <div className={styles.lumenCollaboratorsStrip}>
        <div
          className={styles.lumenCollaboratorActiveBadge}
          title={`Active collaborator: ${currentUser?.name || display_full_name}`}
        >
          <LUMEN_user_avatar
            user_avatar={has_user_avatar ? effective_auth.user_avatar : (currentUser?.user_avatar || currentUser?.avatar)}
            user_account={has_user_account ? effective_auth.user_account : (currentUser?.user_account || currentUser?.id)}
            user_full_name={has_user_full_name ? effective_auth.user_full_name : currentUser?.name}
            user_status={has_user_status ? effective_auth.user_status : (is_guest ? 'guest' : 'active')}
            size={22}
            show_status={true}
            bg_color={currentUser?.color || '#2563eb'}
          />
          <span className={styles.lumenUserNameText}>{display_first_name}</span>
        </div>

        {/* Other online collaborators avatars */}
        <div className={styles.lumenCollaboratorsAvatars}>
          {collaborators.filter(u => u.id !== currentUser.id).slice(0, 3).map((u) => (
            <div
              key={u.id}
              className={styles.lumenCollaboratorBubble}
              style={{ backgroundColor: 'transparent', border: 'none', padding: 0 }}
              title={`${u.name} (${u.role || 'Collaborator'})`}
            >
              <LUMEN_user_avatar
                user_avatar={u.user_avatar || u.avatar}
                user_account={u.user_account || u.id}
                user_full_name={u.name}
                user_status="active"
                size={22}
                bg_color={u.color || '#2563eb'}
                title={`${u.name} (${u.role || 'Collaborator'})`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Zone 3: Board Actions */}
      <div className={styles.lumenActionZone}>
        {activeBoard?.id && selectedCardsSignal.value.length > 1 && (
          <button
            type="button"
            className={`${styles.lumenSecondaryButton} ${styles.lumenButtonActive}`}
            onClick={() => createGroupCard({ card_ids: selectedCardsSignal.value })}
            title={`Group ${selectedCardsSignal.value.length} selected cards into a frame`}
          >
            <Boxes size={14} color="var(--lumen-accent)" />
            <span>Group ({selectedCardsSignal.value.length})</span>
          </button>
        )}

        <button
          type="button"
          className={styles.lumenSecondaryButton}
          onClick={() => (isTemplateModalOpenSignal.value = true)}
          title="Choose a curated board template"
        >
          <LayoutTemplate size={14} />
          <span>Templates</span>
        </button>

        <button
          type="button"
          className={`${styles.lumenSecondaryButton} ${
            isActivityDrawerOpenSignal.value ? styles.lumenButtonActive : ''
          }`}
          onClick={toggleActivityDrawer}
          title="Toggle Activity & Collaboration History Log"
        >
          <History size={14} />
          <span>Activity</span>
          {activityLogsSignal.value.length > 0 && (
            <span className={styles.lumenActivityCountBadge}>
              {activityLogsSignal.value.length}
            </span>
          )}
        </button>

        {activeBoard?.id && (
          <>
            {(() => {
              const active_sharing = normalize_board_sharing(
                activeBoard.sharing || activeBoard.board_setting?.sharing
              );
              const is_public = active_sharing.visibility === 'public';
              return (
                <button
                  type="button"
                  className={`${styles.lumenShareButton || styles['lumen-share-button']} ${
                    is_public
                      ? (styles.lumenShareButtonPublic || styles['lumen-share-button-public'])
                      : (styles.lumenShareButtonPrivate || styles['lumen-share-button-private'])
                  } ${isShareModalOpenSignal.value ? styles.lumenButtonActive : ''}`}
                  onClick={() => openShareModal(activeBoard.id)}
                  title={
                    is_public
                      ? `Public (${active_sharing.public_role || 'viewer'}) — Click to manage sharing`
                      : 'Private (Restricted) — Click to share board'
                  }
                >
                  {is_public ? <Globe size={14} /> : <Lock size={14} />}
                  <span>Share</span>
                </button>
              );
            })()}

            <button
              type="button"
              className={`${styles.lumenSecondaryButton} ${
                isPropertyPanelOpenSignal.value && selectedCardsSignal.value.length > 0 ? styles.lumenButtonActive : ''
              }`}
              onClick={() => {
                if (selectedCardsSignal.value.length === 0) {
                  const firstCard = activeBoard?.cards?.[0];
                  if (firstCard) {
                    selectedCardsSignal.value = [firstCard.id];
                    isPropertyPanelOpenSignal.value = true;
                  }
                } else {
                  togglePropertyPanel();
                }
              }}
              title={selectedCardsSignal.value.length > 0 ? "Toggle Card Property Panel & AI Notes" : "Select a card to view properties"}
            >
              <Sliders size={14} />
              <span>Properties</span>
            </button>

            {/* Wide Screen: Auto Open Card Property Switch Button */}
            <button
              type="button"
              className={`${styles.lumenSecondaryButton} ${styles.lumenAutoOpenSwitchBtn} ${
                isAutoOpenPropertyEnabledSignal.value ? styles.lumenAutoOpenSwitchActive : ''
              }`}
              onClick={() => {
                const nextVal = toggleAutoOpenProperty();
                showToast(
                  nextVal
                    ? 'Auto-open card properties enabled'
                    : 'Auto-open card properties disabled'
                );
              }}
              title={
                isAutoOpenPropertyEnabledSignal.value
                  ? 'Auto-open Properties: ON (Selecting a card automatically opens properties on wide screen). Click to turn OFF.'
                  : 'Auto-open Properties: OFF (Selecting a card will not auto-open properties). Click to turn ON.'
              }
            >
              <span className={styles.lumenSwitchPill}>
                <span
                  className={`${styles.lumenSwitchThumb} ${
                    isAutoOpenPropertyEnabledSignal.value ? styles.lumenSwitchThumbActive : ''
                  }`}
                />
              </span>
              <span>Auto-open: {isAutoOpenPropertyEnabledSignal.value ? 'ON' : 'OFF'}</span>
            </button>
          </>
        )}
      </div>

      {/* Mobile-Only Quick Bar (Clean, non-crowded controls for phones) */}
      <div className={styles.lumenMobileQuickBar}>
        {activeBoard?.id && (
          <button
            ref={mobileZoomRef}
            type="button"
            className={`${styles.lumenMobileZoomBtn} ${
              isZoomPopupOpen ? (styles.lumenMobileZoomBtnActive || styles['lumen-mobile-zoom-btn-active']) : ''
            }`}
            onClick={() => setIsZoomPopupOpen(!isZoomPopupOpen)}
            title={`Zoom (${zoomPercent}%) - Tap for slider & reset`}
            aria-label="Toggle zoom popup slider and reset"
          >
            <ZoomIn size={12} style={{ marginRight: 3 }} />
            <span>{zoomPercent}%</span>
          </button>
        )}

        <div
          className={styles.lumenMobileUserBadge}
          title={`Active collaborator: ${currentUser?.name || display_full_name}`}
        >
          <LUMEN_user_avatar
            user_avatar={has_user_avatar ? effective_auth.user_avatar : (currentUser?.user_avatar || currentUser?.avatar)}
            user_account={has_user_account ? effective_auth.user_account : (currentUser?.user_account || currentUser?.id)}
            user_full_name={has_user_full_name ? effective_auth.user_full_name : currentUser?.name}
            user_status={has_user_status ? effective_auth.user_status : (is_guest ? 'guest' : 'active')}
            size={26}
            show_status={true}
            bg_color={currentUser?.color || '#2563eb'}
          />
        </div>

        <button
          type="button"
          className={styles.lumenMobileMenuBtn}
          onClick={() => {
            setIsMenuOpen(false);
            setIsUserMenuOpen(false);
            setIsZoomPopupOpen(false);
            setIsMobileMenuOpen(!isMobileMenuOpen);
          }}
          title="Open workspace menu"
          aria-label="Open workspace menu"
        >
          {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Responsive Mobile Drawer Navigation Menu */}
      {isMobileMenuOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className={styles.lumenMobileDrawerBackdrop} onClick={() => setIsMobileMenuOpen(false)}>
            <div
              className={styles.lumenMobileDrawerWindow}
              ref={mobileMenuRef}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Drawer Header */}
            <div className={styles.lumenMobileDrawerHeader}>
              <div className={styles.lumenMobileDrawerTitle}>
                <span className={styles.lumenWordmarkDot} />
                <span>Workspace Menu</span>
              </div>
              <button
                type="button"
                className={styles.lumenMobileDrawerCloseBtn}
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.lumenMobileDrawerScroll}>
              {/* Section 1: Canvas Navigation & Zoom Slider */}
              {activeBoard?.id && (
                <div className={styles.lumenMobileDrawerSection}>
                  <div className={styles.lumenMobileZoomHeaderRow}>
                    <div className={styles.lumenMobileDrawerSectionTitle}>Zoom Slider</div>
                    <div className={styles.lumenMobileZoomHeaderActions}>
                      <span className={styles.lumenMobileZoomBadge}>{zoomPercent}%</span>
                      {zoomPercent !== 100 && (
                        <button
                          type="button"
                          className={styles.lumenMobileZoomResetPill}
                          onClick={handleResetZoom}
                          title="Reset zoom to 100%"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Interactive Zoom Slider Box */}
                  <div
                    className={styles.lumenMobileZoomSliderCard}
                    style={{
                      '--lumen-slider-fill': `${Math.min(
                        100,
                        Math.max(0, Math.round(((zoomPercent - 30) / (200 - 30)) * 100))
                      )}%`,
                    }}
                  >
                    <div className={styles.lumenMobileZoomSliderRow}>
                      <button
                        type="button"
                        className={styles.lumenMobileZoomStepBtn}
                        onClick={() => handleZoomChange(-0.1)}
                        disabled={zoomPercent <= 30}
                        title="Zoom Out (-10%)"
                        aria-label="Zoom Out"
                      >
                        <Minus size={14} />
                      </button>

                      <input
                        type="range"
                        min="30"
                        max="200"
                        step="1"
                        value={zoomPercent}
                        onChange={(e) => handleZoomTo(Number(e.target.value) / 100)}
                        className={styles.lumenMobileZoomSliderInput}
                        aria-label="Canvas Zoom Slider"
                      />

                      <button
                        type="button"
                        className={styles.lumenMobileZoomStepBtn}
                        onClick={() => handleZoomChange(0.1)}
                        disabled={zoomPercent >= 200}
                        title="Zoom In (+10%)"
                        aria-label="Zoom In"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className={styles.lumenMobileZoomPresetsRow}>
                      {[50, 75, 100, 125, 150, 200].map((val) => {
                        const is_active = Math.abs(zoomPercent - val) <= 1;
                        return (
                          <button
                            key={val}
                            type="button"
                            className={`${styles.lumenMobileZoomPresetBtn} ${
                              is_active ? styles.lumenMobileZoomPresetBtnActive : ''
                            }`}
                            onClick={() => handleZoomTo(val / 100)}
                          >
                            {val}%
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Snap to Grid Toggle */}
                  <button
                    type="button"
                    className={styles.lumenMobileDrawerRowBtn}
                    onClick={() => {
                      snapToGridSignal.value = !snapToGridSignal.value;
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Grid size={15} />
                      <span>Snap to Grid ({gridDimensionSignal.value || 24}px)</span>
                    </div>
                    <span className={`${styles.lumenMobileSwitchTag} ${snapToGridSignal.value ? styles.lumenMobileSwitchTagActive : ''}`}>
                      {snapToGridSignal.value ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              )}

              {/* Section 2: Workspace Actions & Panels */}
              <div className={styles.lumenMobileDrawerSection}>
                <div className={styles.lumenMobileDrawerSectionTitle}>Panels & Inspector</div>
                <div className={styles.lumenMobileToolGrid}>
                  {activeBoard?.id && (
                    <button
                      type="button"
                      className={`${styles.lumenMobileToolItem} ${isShareModalOpenSignal.value ? styles.lumenMobileToolItemActive : ''}`}
                      onClick={() => {
                        openShareModal(activeBoard.id);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <Share2 size={15} />
                      <span>Share Board</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.lumenMobileToolItem} ${isPropertyPanelOpenSignal.value ? styles.lumenMobileToolItemActive : ''}`}
                    onClick={() => {
                      togglePropertyPanel();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <Sliders size={15} />
                    <span>Properties</span>
                  </button>
                  <button
                    type="button"
                    className={styles.lumenMobileToolItem}
                    onClick={() => {
                      toggleLayerPanel();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <Layers size={15} />
                    <span>Layers</span>
                  </button>
                  <button
                    type="button"
                    className={styles.lumenMobileToolItem}
                    onClick={() => {
                      toggleBoardSettingsPanel();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <Settings size={15} />
                    <span>Settings</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.lumenMobileToolItem} ${isActivityDrawerOpenSignal.value ? styles.lumenMobileToolItemActive : ''}`}
                    onClick={() => {
                      toggleActivityDrawer();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <History size={15} />
                    <span>Activity</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.lumenMobileToolItem} ${styles.lumenMobileToolItemAi}`}
                    onClick={() => {
                      toggleAiPanel();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <Sparkles size={15} />
                    <span>AI Assistant</span>
                  </button>
                </div>

                <button
                  type="button"
                  className={styles.lumenMobileDrawerRowBtn}
                  onClick={() => {
                    isTemplateModalOpenSignal.value = true;
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LayoutTemplate size={15} />
                    <span>Curated Templates</span>
                  </div>
                </button>

                {selectedCardsSignal.value.length > 1 && (
                  <button
                    type="button"
                    className={styles.lumenMobileDrawerRowBtn}
                    onClick={() => {
                      createGroupCard({ card_ids: selectedCardsSignal.value });
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Boxes size={15} color="var(--lumen-accent)" />
                      <span>Group {selectedCardsSignal.value.length} Selected Cards</span>
                    </div>
                  </button>
                )}

                {/* Auto Open Card Property setting row */}
                <button
                  type="button"
                  className={styles.lumenMobileDrawerRowBtn}
                  onClick={() => {
                    const nextVal = toggleAutoOpenProperty();
                    showToast(
                      nextVal
                        ? 'Auto-open card properties enabled for wide screen'
                        : 'Auto-open card properties disabled'
                    );
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sliders size={15} />
                    <span>Auto-open Properties (Wide Screen)</span>
                  </div>
                  <span
                    className={`${styles.lumenMobileSwitchTag} ${
                      isAutoOpenPropertyEnabledSignal.value ? styles.lumenMobileSwitchTagActive : ''
                    }`}
                  >
                    {isAutoOpenPropertyEnabledSignal.value ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              {/* Section 3: Workspace Boards */}
              <div className={styles.lumenMobileDrawerSection}>
                <div className={styles.lumenMobileDrawerSectionTitle}>Switch Boards</div>
                <button
                  type="button"
                  className={`${styles.lumenMobileBoardItem} ${!activeBoard?.id ? styles.lumenMobileBoardItemActive : ''}`}
                  onClick={handleNavigateAllBoards}
                  style={{ marginBottom: 6 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FolderKanban size={14} color="var(--lumen-accent)" />
                    <span style={{ fontWeight: !activeBoard?.id ? 600 : 500 }}>All Boards Directory</span>
                  </div>
                  {!activeBoard?.id && <Check size={14} color="var(--lumen-accent)" />}
                </button>
                <div className={styles.lumenMobileBoardList}>
                  {boardsList.map((b) => {
                    const isActive = b.id === activeBoard?.id;
                    const bType = b.boardType || (b.id === 'board_blank' ? 'free_position' : 'snap_grid');
                    return (
                      <button
                        key={b.id}
                        type="button"
                        className={`${styles.lumenMobileBoardItem} ${isActive ? styles.lumenMobileBoardItemActive : ''}`}
                        onClick={() => handleSwitchBoard(b.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FolderKanban size={14} color={isActive ? 'var(--lumen-accent)' : 'inherit'} />
                          <span style={{ fontWeight: isActive ? 600 : 500 }}>{b.title}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className={styles.lumenBoardTypeBadge}>
                            {bType === 'free_position' ? 'Free' : 'Grid'}
                          </span>
                          {isActive && <Check size={14} color="var(--lumen-accent)" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className={styles.lumenMobileNewBoardBtn}
                    onClick={() => handleCreateNew('snap_grid')}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Plus size={14} />
                    <span>New Board</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Zoom Popup with Slider and Reset Zoom */}
      <LUMEN_zoom_popup
        is_open={isZoomPopupOpen}
        on_close={() => setIsZoomPopupOpen(false)}
        anchor_ref={mobileZoomRef}
        position_mode="header"
      />
    </header>
  );
}
