import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  ExternalLink,
  ChevronDown,
  ClipboardPaste,
  Loader2,
  Share2,
  Maximize2,
  Radio,
  Music,
  Video,
  FileText,
  Code,
  Sparkles,
} from 'lucide-react';

import styles from './LUMEN_social_media_card.module.css';
import LUMEN_pinterest_embed, { parse_pinterest_url } from './LUMEN_pinterest_embed.jsx';
import {
  updateCard,
  showToast,
  saveCurrentBoardToStore,
} from '../../signals/boardState.js';

// Calculate optimal card width and height based on the original content aspect ratio
export const compute_optimal_dimensions = (platform, social_type, currentWidth) => {
  const w = currentWidth || 384;

  if (platform === 'spotify') {
    if (social_type === 'playlist' || social_type === 'album' || social_type === 'show') {
      return { width: Math.max(360, w), height: 440 };
    }
    // Track or episode
    return { width: Math.max(360, w), height: 232 };
  }

  if (platform === 'soundcloud') {
    if (social_type === 'playlist' || social_type === 'set') {
      return { width: Math.max(360, w), height: 420 };
    }
    return { width: Math.max(360, w), height: 240 };
  }

  if (platform === 'vimeo') {
    const targetW = Math.max(360, w);
    const targetH = Math.round((targetW - 24) * (9 / 16)) + 126;
    return { width: targetW, height: Math.max(300, targetH) };
  }

  if (platform === 'bilibili') {
    const targetW = Math.max(360, w);
    const targetH = Math.round((targetW - 24) * (9 / 16)) + 136;
    return { width: targetW, height: Math.max(310, targetH) };
  }

  if (platform === 'youtube') {
    if (social_type === 'shorts') {
      const targetW = Math.max(312, Math.min(w, 360));
      const targetH = Math.round((targetW - 24) * (16 / 9)) + 126;
      return { width: targetW, height: targetH };
    }
    // 16:9 regular widescreen video
    const targetW = Math.max(w, 384);
    const targetH = Math.round((targetW - 24) * (9 / 16)) + 126;
    return { width: targetW, height: targetH };
  }

  if (platform === 'instagram') {
    if (social_type === 'post') {
      const targetW = Math.max(336, w);
      return { width: targetW, height: targetW + 126 };
    }
    // Reel (vertical)
    const targetW = Math.max(336, Math.min(w, 408));
    return { width: targetW, height: 552 };
  }

  if (platform === 'tiktok') {
    const targetW = Math.max(336, Math.min(w, 384));
    return { width: targetW, height: 576 };
  }

  if (platform === 'x') {
    return { width: Math.max(w, 384), height: 480 };
  }

  if (platform === 'threads') {
    return { width: Math.max(w, 384), height: 500 };
  }

  if (platform === 'pinterest') {
    const targetW = Math.max(340, w);
    if (social_type === 'board' || social_type === 'profile') {
      return { width: targetW, height: 460 };
    }
    return { width: targetW, height: 520 };
  }

  return { width: Math.max(360, w), height: 380 };
};

// Extract Instagram shortcode
export const extract_instagram_shortcode = (url) => {
  if (!url) return null;
  const match = url.match(/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i);
  return match && match[1] ? match[1] : null;
};

// Extract TikTok video ID
export const extract_tiktok_id = (url) => {
  if (!url) return null;
  const match =
    url.match(/(?:video|v|embed\/v2|player\/v1)\/(\d+)/i) ||
    url.match(/item_id=(\d+)/i) ||
    url.match(/(\d{15,22})/);
  return match && match[1] ? match[1] : null;
};

// Extract YouTube video ID
export const extract_youtube_id = (url) => {
  if (!url) return null;
  const reg_exp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(reg_exp);
  return match && match[2].length === 11 ? match[2] : null;
};

// Extract Vimeo ID
export const extract_vimeo_id = (url) => {
  if (!url) return null;
  const match = url.match(/(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/\d+\/video\/|video\/|)(\d+)|player\.vimeo\.com\/video\/(\d+))/i);
  return match ? (match[1] || match[2]) : null;
};

// Extract Bilibili BVID or AVID
export const extract_bilibili_id = (url) => {
  if (!url) return { bvid: null, aid: null };
  const bvid_match = url.match(/(BV[a-zA-Z0-9]+)/i);
  const aid_match = url.match(/(?:av|aid=)(\d+)/i);
  return {
    bvid: bvid_match ? bvid_match[1] : null,
    aid: aid_match ? aid_match[1] : null,
  };
};

// Extract X (Twitter) status/post ID
export const extract_x_id = (url) => {
  if (!url) return null;
  const match =
    url.match(/(?:x\.com|twitter\.com)\/(?:#!\/)?(?:[^\/]+\/status(?:es)?|i\/web\/status|i\/status)\/(\d+)/i) ||
    url.match(/(?:tweet|id)=(\d{10,22})/i) ||
    url.match(/\/status\/(\d+)/i);
  return match && match[1] ? match[1] : null;
};

// Format X (Twitter) official embed URL
export const format_x_embed_url = (url, fallback_id) => {
  const id = extract_x_id(url) || fallback_id || '1845864310681674011';
  return `https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=light&dnt=true`;
};

// Extract Threads post info (username & shortcode)
export const extract_threads_info = (url) => {
  if (!url) return { username: null, shortcode: null };
  const user_post_match = url.match(/(?:threads\.com|threads\.net)\/@([A-Za-z0-9_.-]+)\/post\/([A-Za-z0-9_-]+)/i);
  if (user_post_match) {
    return { username: user_post_match[1], shortcode: user_post_match[2] };
  }
  const short_match = url.match(/(?:threads\.com|threads\.net)\/(?:t|post)\/([A-Za-z0-9_-]+)/i);
  if (short_match) {
    return { username: null, shortcode: short_match[1] };
  }
  return { username: null, shortcode: null };
};

// Format Threads official embed URL
export const format_threads_embed_url = (url, fallback_shortcode, fallback_username) => {
  const extracted = extract_threads_info(url);
  const code = extracted.shortcode || fallback_shortcode || 'CuX_UYSt5sO';
  const user = extracted.username || fallback_username || 'threads';
  return `https://www.threads.net/@${user}/post/${code}/embed`;
};

// Format Spotify embed URL
export const format_spotify_embed_url = (url) => {
  if (!url) return '';
  if (url.includes('open.spotify.com/embed/')) return url;
  const match = url.match(/open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/i);
  if (match) {
    return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
  }
  return url;
};

// Format SoundCloud embed player URL
export const format_soundcloud_embed_url = (url) => {
  if (!url) return '';
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
};

// Helper to detect platform from input URL
export const detect_social_platform = (url) => {
  if (!url) return { platform: 'generic', social_type: 'embed' };
  const lower_url = url.toLowerCase();

  if (lower_url.includes('spotify.com')) {
    const is_playlist = lower_url.includes('/playlist/');
    const is_album = lower_url.includes('/album/');
    return {
      platform: 'spotify',
      social_type: is_playlist ? 'playlist' : is_album ? 'album' : 'track',
    };
  }

  if (lower_url.includes('soundcloud.com')) {
    const is_set = lower_url.includes('/sets/');
    return {
      platform: 'soundcloud',
      social_type: is_set ? 'playlist' : 'track',
    };
  }

  if (lower_url.includes('vimeo.com')) {
    const vimeo_id = extract_vimeo_id(url);
    return { platform: 'vimeo', social_type: 'video', video_id: vimeo_id };
  }

  if (lower_url.includes('bilibili.com') || lower_url.includes('b23.tv')) {
    const { bvid, aid } = extract_bilibili_id(url);
    return { platform: 'bilibili', social_type: 'video', bvid, aid };
  }

  if (lower_url.includes('instagram.com') || lower_url.includes('instagr.am')) {
    const is_reel = lower_url.includes('/reel') || lower_url.includes('/reels');
    return { platform: 'instagram', social_type: is_reel ? 'reel' : 'post' };
  }

  if (lower_url.includes('tiktok.com')) {
    return { platform: 'tiktok', social_type: 'reel' };
  }

  if (lower_url.includes('youtube.com') || lower_url.includes('youtu.be')) {
    const is_shorts = lower_url.includes('/shorts/');
    const video_id = extract_youtube_id(url);
    return { platform: 'youtube', social_type: is_shorts ? 'shorts' : 'video', video_id };
  }

  if (lower_url.includes('x.com') || lower_url.includes('twitter.com')) {
    const video_id = extract_x_id(url);
    return { platform: 'x', social_type: 'post', video_id };
  }

  if (lower_url.includes('threads.com') || lower_url.includes('threads.net')) {
    const { shortcode, username } = extract_threads_info(url);
    return { platform: 'threads', social_type: 'post', shortcode, username };
  }

  if (lower_url.includes('pinterest.com') || lower_url.includes('pin.it')) {
    return { platform: 'pinterest', social_type: 'pin' };
  }

  return { platform: 'generic', social_type: 'embed' };
};

// Preset configurations for manual platform switching
export const PLATFORM_TEMPLATES = {
  spotify_track: {
    platform: 'spotify',
    social_type: 'track',
    label: 'Spotify Track',
    url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
    height: 232,
    width: 380,
  },
  spotify_playlist: {
    platform: 'spotify',
    social_type: 'playlist',
    label: 'Spotify Playlist',
    url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    height: 440,
    width: 380,
  },
  soundcloud_track: {
    platform: 'soundcloud',
    social_type: 'track',
    label: 'SoundCloud Track',
    url: 'https://soundcloud.com/chilledcow/sets/lofi-hip-hop-radio',
    height: 240,
    width: 380,
  },
  vimeo_video: {
    platform: 'vimeo',
    social_type: 'video',
    label: 'Vimeo Video',
    url: 'https://vimeo.com/76979871',
    video_id: '76979871',
    height: 310,
    width: 400,
  },
  bilibili_video: {
    platform: 'bilibili',
    social_type: 'video',
    label: 'Bilibili Video',
    url: 'https://www.bilibili.com/video/BV1xx411c7mD',
    bvid: 'BV1xx411c7mD',
    height: 330,
    width: 400,
  },
  youtube_video: {
    platform: 'youtube',
    social_type: 'video',
    label: 'YouTube Video',
    url: 'https://www.youtube.com/watch?v=LXb3EKWsInQ',
    video_id: 'LXb3EKWsInQ',
    height: 330,
    width: 400,
  },
  youtube_shorts: {
    platform: 'youtube',
    social_type: 'shorts',
    label: 'YouTube Shorts',
    url: 'https://www.youtube.com/shorts/5qap5aO4i9A',
    video_id: '5qap5aO4i9A',
    height: 480,
    width: 336,
  },
  instagram_reel: {
    platform: 'instagram',
    social_type: 'reel',
    label: 'Instagram Reel',
    url: 'https://www.instagram.com/reel/C8x9Y2mKq4Z/',
    shortcode: 'C8x9Y2mKq4Z',
    height: 540,
    width: 360,
  },
  tiktok: {
    platform: 'tiktok',
    social_type: 'reel',
    label: 'TikTok Video',
    url: 'https://www.tiktok.com/@scout2015/video/6718335390845095173',
    video_id: '6718335390845095173',
    height: 560,
    width: 340,
  },
  x_post: {
    platform: 'x',
    social_type: 'post',
    label: 'X (Twitter) Post',
    url: 'https://x.com/NASA/status/1845864310681674011',
    video_id: '1845864310681674011',
    height: 480,
    width: 384,
  },
  threads_post: {
    platform: 'threads',
    social_type: 'post',
    label: 'Threads Post',
    url: 'https://www.threads.com/@threads/post/CuX_UYSt5sO',
    shortcode: 'CuX_UYSt5sO',
    username: 'threads',
    height: 500,
    width: 384,
  },
  pinterest_pin: {
    platform: 'pinterest',
    social_type: 'pin',
    label: 'Pinterest Pin',
    url: 'https://www.pinterest.com/pin/424605071093691246/',
    height: 520,
    width: 384,
  },
};

// Platform Brand SVG Glyphs
export const render_platform_glyph = (platform, size = 14) => {
  switch (platform) {
    case 'spotify':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      );
    case 'soundcloud':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.56 8.87V17h9.12c1.83 0 3.32-1.48 3.32-3.31 0-1.8-1.44-3.26-3.23-3.31-.38-2.61-2.62-4.63-5.34-4.63-1.63 0-3.08.72-4.08 1.86-.34-.47-.46-.74-.79-.74v2zm-2.06.66c-.32 0-.58.33-.58.74v6.73h1.16v-6.73c0-.41-.26-.74-.58-.74zm-2.06 1.48c-.32 0-.58.33-.58.74v5.25h1.16v-5.25c0-.41-.26-.74-.58-.74zm-2.06 1.15c-.32 0-.58.33-.58.74v4.1h1.16v-4.1c0-.41-.26-.74-.58-.74zm-2.06 1.15c-.32 0-.58.33-.58.74v2.95h1.16v-2.95c0-.41-.26-.74-.58-.74zm-2.06 1.15c-.32 0-.58.33-.58.74v1.8h1.16v-1.8c0-.41-.26-.74-.58-.74z" />
        </svg>
      );
    case 'vimeo':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.525 3.01 7.525c-.179 0-.806.378-1.881 1.131L0 7.218C1.3 6.074 2.656 4.965 4.07 3.89c1.94-1.464 3.39-2.242 4.35-2.332 2.298-.217 3.716 1.348 4.256 4.695.58 3.593 1.002 5.82 1.266 6.68.802 2.68 1.688 4.02 2.658 4.02.756 0 1.67-.935 2.742-2.805 1.07-1.87 1.642-3.308 1.716-4.314.126-1.636-.45-2.454-1.728-2.454-.606 0-1.226.138-1.86.414 1.26-4.14 3.66-6.147 7.2-6.02 2.63.09 3.86 1.63 3.687 4.642z" />
        </svg>
      );
    case 'bilibili':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.813 4.653h.854c1.51 0 2.733 1.224 2.733 2.734v10.14c0 1.51-1.223 2.734-2.733 2.734H5.333c-1.51 0-2.733-1.224-2.733-2.734V7.387c0-1.51 1.223-2.734 2.733-2.734h.854L4.35 2.55a.853.853 0 1 1 1.3-.997l2.84 3.1h7.02l2.84-3.1a.853.853 0 1 1 1.3.997l-1.837 2.103zM5.333 6.36c-.567 0-1.027.46-1.027 1.027v10.14c0 .567.46 1.027 1.027 1.027h13.334c.567 0 1.026-.46 1.026-1.027V7.387c0-.567-.46-1.027-1.026-1.027H5.333zm3.073 4.267c.47 0 .854.384.854.853v2.56a.853.853 0 1 1-1.707 0v-2.56c0-.47.383-.853.853-.853zm7.187 0c.471 0 .854.384.854.853v2.56a.854.854 0 1 1-1.707 0v-2.56c0-.47.383-.853.853-.853z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.891 2.891 2.896 2.896 0 0 1-2.892-2.891 2.896 2.896 0 0 1 2.892-2.892c.307 0 .602.046.88.132V9.432a6.34 6.34 0 0 0-.88-.063A6.338 6.338 0 0 0 3 15.707a6.338 6.338 0 0 0 6.338 6.338 6.338 6.338 0 0 0 6.338-6.338V8.924a8.196 8.196 0 0 0 3.913 1.25V6.73a4.83 4.83 0 0 1-.004-.044z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'x':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'threads':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221Z" />
        </svg>
      );
    case 'pinterest':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0a12 12 0 0 0-4.37 23.18c-.06-.98-.12-2.48.02-3.55.13-.97.87-6.23.87-6.23s-.22-.44-.22-1.09c0-1.02.59-1.78 1.33-1.78.63 0 .93.47.93 1.04 0 .63-.4 1.58-.61 2.45-.17.74.37 1.34 1.1 1.34 1.32 0 2.34-1.39 2.34-3.4 0-1.78-1.28-3.02-3.1-3.02-2.11 0-3.35 1.58-3.35 3.22 0 .64.24 1.32.55 1.7.06.07.07.14.05.21-.06.24-.18.74-.21.84-.03.14-.11.17-.25.1-1-.46-1.62-1.92-1.62-3.09 0-2.52 1.83-4.83 5.28-4.83 2.77 0 4.93 1.98 4.93 4.62 0 2.76-1.74 4.98-4.15 4.98-.81 0-1.57-.42-1.83-.92l-.5 1.9c-.18.7-.67 1.57-.99 2.1A12 12 0 1 0 12 0z" />
        </svg>
      );
    default:
      return <Radio size={size} />;
  }
};

export default function LUMEN_embed_card({ card }) {
  useSignals();
  const dropdown_ref = useRef(null);
  const debounce_timer_ref = useRef(null);

  const [is_menu_open, set_is_menu_open] = useState(false);
  const [url_input, set_url_input] = useState(card.url || '');
  const [is_syncing, set_is_syncing] = useState(false);

  const current_platform = card.platform || 'spotify';
  const current_social_type = card.social_type || 'track';

  const video_id = card.video_id || extract_youtube_id(card.url);
  const vimeo_id = card.video_id || extract_vimeo_id(card.url);
  const { bvid: bili_bvid, aid: bili_aid } = extract_bilibili_id(card.url);
  const instagram_shortcode = card.shortcode || extract_instagram_shortcode(card.url) || 'C8x9Y2mKq4Z';
  const tiktok_id = card.video_id || extract_tiktok_id(card.url) || '6718335390845095173';
  const x_tweet_id = card.video_id || extract_x_id(card.url) || '1845864310681674011';
  const { shortcode: extracted_threads_code, username: extracted_threads_user } = extract_threads_info(card.url);
  const threads_shortcode = card.shortcode || extracted_threads_code || 'CuX_UYSt5sO';
  const threads_username = card.username || extracted_threads_user || 'threads';

  // Sync internal url_input if card.url changes externally
  useEffect(() => {
    set_url_input(card.url || '');
  }, [card.url]);

  // Close dropdown on outside click
  useEffect(() => {
    const handle_click_outside = (e) => {
      if (dropdown_ref.current && e.target instanceof Node && !dropdown_ref.current.contains(e.target)) {
        set_is_menu_open(false);
      }
    };
    document.addEventListener('mousedown', handle_click_outside);
    return () => document.removeEventListener('mousedown', handle_click_outside);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounce_timer_ref.current) {
        clearTimeout(debounce_timer_ref.current);
      }
    };
  }, []);

  // Execute the content auto-update from the link
  const auto_update_content_from_url = async (target_url, is_explicit = false) => {
    const clean_url = (target_url || '').trim();
    if (!clean_url) return;

    set_is_syncing(true);

    const platform_info = detect_social_platform(clean_url);
    const clean_title =
      platform_info.platform === 'spotify'
        ? (platform_info.social_type === 'playlist' ? 'Spotify Playlist' : platform_info.social_type === 'album' ? 'Spotify Album' : 'Spotify Track')
        : platform_info.platform === 'soundcloud'
          ? (platform_info.social_type === 'playlist' ? 'SoundCloud Set' : 'SoundCloud Track')
          : platform_info.platform === 'vimeo'
            ? 'Vimeo Video'
            : platform_info.platform === 'bilibili'
              ? 'Bilibili Video'
              : platform_info.platform === 'instagram'
                ? (platform_info.social_type === 'reel' ? 'Instagram Reel' : 'Instagram Post')
                : platform_info.platform === 'tiktok'
                  ? 'TikTok Video'
                  : platform_info.platform === 'youtube'
                    ? (platform_info.social_type === 'shorts' ? 'YouTube Shorts' : 'YouTube Video')
                    : platform_info.platform === 'x'
                      ? 'X (Twitter) Post'
                      : platform_info.platform === 'threads'
                        ? 'Threads Post'
                        : platform_info.platform === 'pinterest'
                          ? 'Pinterest Pin'
                          : 'Web Embed';

    const updates = {
      url: clean_url,
      platform: platform_info.platform,
      social_type: platform_info.social_type,
      title: clean_title,
    };

    if (platform_info.platform === 'vimeo') {
      const v_id = extract_vimeo_id(clean_url);
      if (v_id) updates.video_id = v_id;
    } else if (platform_info.platform === 'bilibili') {
      const { bvid, aid } = extract_bilibili_id(clean_url);
      if (bvid) updates.bvid = bvid;
      if (aid) updates.aid = aid;
    } else if (platform_info.platform === 'instagram') {
      const shortcode = extract_instagram_shortcode(clean_url);
      if (shortcode) updates.shortcode = shortcode;
    } else if (platform_info.platform === 'tiktok') {
      const extracted_tid = extract_tiktok_id(clean_url);
      if (extracted_tid) updates.video_id = extracted_tid;
    } else if (platform_info.platform === 'youtube') {
      const extracted_id = extract_youtube_id(clean_url);
      if (extracted_id) updates.video_id = extracted_id;
    } else if (platform_info.platform === 'x') {
      const extracted_x_id = extract_x_id(clean_url);
      if (extracted_x_id) updates.video_id = extracted_x_id;
    } else if (platform_info.platform === 'threads') {
      const { shortcode, username } = extract_threads_info(clean_url);
      if (shortcode) updates.shortcode = shortcode;
      if (username) updates.username = username;
    } else if (platform_info.platform === 'pinterest') {
      updates.social_type = 'pin';
      updates.title = 'Pinterest Pin';
    }

    // Auto-resize card dimensions based on content type
    const optimalDim = compute_optimal_dimensions(platform_info.platform, platform_info.social_type, card.width);
    updates.width = optimalDim.width;
    updates.height = optimalDim.height;

    updateCard(card.id, updates, is_explicit);
    set_is_syncing(false);
    saveCurrentBoardToStore();
    showToast(`Updated to ${clean_title} & auto-resized`);
  };

  // Debounced input change handler
  const handle_input_change = (e) => {
    const new_value = e.target.value;
    set_url_input(new_value);

    if (debounce_timer_ref.current) {
      clearTimeout(debounce_timer_ref.current);
    }

    debounce_timer_ref.current = setTimeout(() => {
      auto_update_content_from_url(new_value, false);
    }, 450);
  };

  // Immediate update on paste
  const handle_paste_input = (e) => {
    const pasted = e.clipboardData.getData('text');
    if (
      pasted &&
      (pasted.includes('http') ||
        pasted.includes('spotify') ||
        pasted.includes('soundcloud') ||
        pasted.includes('vimeo') ||
        pasted.includes('bilibili') ||
        pasted.includes('youtube') ||
        pasted.includes('youtu.be') ||
        pasted.includes('instagram') ||
        pasted.includes('tiktok') ||
        pasted.includes('x.com') ||
        pasted.includes('twitter') ||
        pasted.includes('threads.com') ||
        pasted.includes('threads.net') ||
        pasted.includes('pinterest') ||
        pasted.includes('pin.it'))
    ) {
      if (debounce_timer_ref.current) {
        clearTimeout(debounce_timer_ref.current);
      }
      set_url_input(pasted);
      setTimeout(() => {
        auto_update_content_from_url(pasted, true);
      }, 30);
    }
  };

  const handle_url_keydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounce_timer_ref.current) {
        clearTimeout(debounce_timer_ref.current);
      }
      auto_update_content_from_url(url_input, true);
    }
  };

  const handle_url_blur = () => {
    if (url_input.trim() && url_input.trim() !== card.url) {
      if (debounce_timer_ref.current) {
        clearTimeout(debounce_timer_ref.current);
      }
      auto_update_content_from_url(url_input, false);
    }
  };

  const handle_clipboard_paste_button = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        set_url_input(text);
        auto_update_content_from_url(text, true);
      }
    } catch (e) {
      showToast('Please paste the URL directly into the input');
    }
  };

  const handle_platform_template_switch = (template_key) => {
    const template = PLATFORM_TEMPLATES[template_key];
    if (!template) return;

    set_is_menu_open(false);
    set_url_input(template.url);

    const optimalDim = compute_optimal_dimensions(template.platform, template.social_type, template.width || card.width);

    updateCard(
      card.id,
      {
        title: template.label,
        platform: template.platform,
        social_type: template.social_type,
        url: template.url,
        shortcode: template.shortcode,
        username: template.username,
        video_id: template.video_id,
        bvid: template.bvid,
        width: optimalDim.width,
        height: optimalDim.height,
      },
      true
    );

    showToast(`Switched to ${template.label} & auto-resized`);
  };

  const handle_autofit_click = (e) => {
    e.stopPropagation();
    const optimalDim = compute_optimal_dimensions(current_platform, current_social_type, card.width);
    updateCard(card.id, { width: optimalDim.width, height: optimalDim.height }, true);
    saveCurrentBoardToStore();
    showToast(`Auto-resized (${optimalDim.width} × ${optimalDim.height}px)`);
  };

  const badge_class = styles[`lumen-social-platform-badge-${current_platform}`] || styles['lumen-social-platform-badge-generic'];

  const platform_label =
    current_platform === 'spotify'
      ? (current_social_type === 'playlist' ? 'Spotify Playlist' : current_social_type === 'album' ? 'Spotify Album' : 'Spotify Track')
      : current_platform === 'soundcloud'
        ? (current_social_type === 'playlist' ? 'SoundCloud Set' : 'SoundCloud')
        : current_platform === 'vimeo'
          ? 'Vimeo Video'
          : current_platform === 'bilibili'
            ? 'Bilibili'
            : current_platform === 'instagram'
              ? (current_social_type === 'reel' ? 'Instagram Reel' : 'Instagram Post')
              : current_platform === 'tiktok'
                ? 'TikTok'
                : current_platform === 'youtube'
                  ? (current_social_type === 'shorts' ? 'YouTube Shorts' : 'YouTube')
                  : current_platform === 'x'
                    ? 'X (Twitter)'
                    : current_platform === 'threads'
                      ? 'Threads'
                      : current_platform === 'pinterest'
                        ? 'Pinterest'
                        : 'Web Embed';

  return (
    <div className={styles['lumen-social-card']}>
      {/* Top Platform Bar */}
      <div className={styles['lumen-social-nav']}>
        <div
          className={`${styles['lumen-social-platform-badge']} ${badge_class}`}
          onClick={() => set_is_menu_open(!is_menu_open)}
          title="Click to select platform"
        >
          <span className={styles['lumen-social-badge-icon']}>
            {render_platform_glyph(current_platform, 13)}
          </span>
          <span className={styles['lumen-social-badge-label']}>{platform_label}</span>
          <ChevronDown size={11} style={{ opacity: 0.8 }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className={styles['lumen-social-autofit-badge']}
            onClick={handle_autofit_click}
            title="Auto-resize card based on content dimensions"
          >
            <Maximize2 size={11} />
            <span>Auto-fit</span>
          </button>

          {is_syncing && (
            <div className={styles['lumen-social-sync-indicator']}>
              <Loader2 size={10} className="animate-spin" />
              <span>Updating...</span>
            </div>
          )}
        </div>
      </div>

      {/* Platform Switcher Dropdown Menu */}
      {is_menu_open && (
        <div
          className={styles['lumen-social-selector-menu']}
          ref={dropdown_ref}
          onWheel={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', color: 'var(--lumen-text-muted)', textTransform: 'uppercase', flexShrink: 0 }}>
            Choose Embed Provider
          </div>
          {Object.entries(PLATFORM_TEMPLATES).map(([key, template]) => {
            const is_active =
              current_platform === template.platform && current_social_type === template.social_type;
            return (
              <button
                key={key}
                type="button"
                className={`${styles['lumen-social-selector-item']} ${
                  is_active ? styles['lumen-social-selector-item-active'] : ''
                }`}
                onClick={() => handle_platform_template_switch(key)}
              >
                {render_platform_glyph(template.platform, 13)}
                <span>{template.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* URL Input Bar */}
      <div className={styles['lumen-social-url-container']}>
        <div className={styles['lumen-social-url-input-wrap']}>
          <div className={styles['lumen-social-url-icon']}>
            {render_platform_glyph(current_platform, 12)}
          </div>
          <input
            type="text"
            className={styles['lumen-social-url-input']}
            value={url_input}
            onChange={handle_input_change}
            onPaste={handle_paste_input}
            onKeyDown={handle_url_keydown}
            onBlur={handle_url_blur}
            placeholder="Paste Spotify, YouTube, Instagram, TikTok, X.com, Threads.com, Vimeo, Pinterest, or web link..."
            title="Paste any audio, video, social reel, X, Threads, or web embed link"
          />
        </div>

        <button
          type="button"
          className={styles['lumen-social-paste-btn']}
          onClick={handle_clipboard_paste_button}
          title="Paste from clipboard"
        >
          <ClipboardPaste size={12} />
          <span>Paste</span>
        </button>

        <a
          href={card.url || '#'}
          target="_blank"
          rel="noreferrer"
          className={styles['lumen-social-external-btn']}
          title={`Open on ${platform_label}`}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={12} />
        </a>
      </div>

      {/* Card Body — Embed Player */}
      <div className={styles['lumen-social-body']}>
        {/* Spotify Player */}
        {current_platform === 'spotify' && (
          <div className={`${styles['lumen-social-player-wrap']} ${styles['lumen-social-player-wrap-audio']}`}>
            <iframe
              src={format_spotify_embed_url(card.url || 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')}
              title="Spotify Player"
              className={styles['lumen-social-embed-frame-audio']}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>
        )}

        {/* SoundCloud Player */}
        {current_platform === 'soundcloud' && (
          <div className={`${styles['lumen-social-player-wrap']} ${styles['lumen-social-player-wrap-audio']}`}>
            <iframe
              src={format_soundcloud_embed_url(card.url || 'https://soundcloud.com/chilledcow/sets/lofi-hip-hop-radio')}
              title="SoundCloud Player"
              className={styles['lumen-social-embed-frame-audio']}
              allow="autoplay"
              scrolling="no"
              loading="lazy"
            />
          </div>
        )}

        {/* Vimeo Video Player */}
        {current_platform === 'vimeo' && vimeo_id && (
          <div className={`${styles['lumen-social-player-wrap']} ${styles['lumen-social-player-wrap-widescreen']}`}>
            <iframe
              src={`https://player.vimeo.com/video/${vimeo_id}?dnt=1&title=0&byline=0&portrait=0`}
              title="Vimeo Video Player"
              className={styles['lumen-social-embed-frame-widescreen']}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Bilibili Video Player */}
        {current_platform === 'bilibili' && (
          <div className={`${styles['lumen-social-player-wrap']} ${styles['lumen-social-player-wrap-widescreen']}`}>
            <iframe
              src={`https://player.bilibili.com/player.html?bvid=${card.bvid || bili_bvid || 'BV1xx411c7mD'}&page=1&high_quality=1&danmaku=0&autoplay=0`}
              title="Bilibili Video Player"
              className={styles['lumen-social-embed-frame-widescreen']}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              scrolling="no"
            />
          </div>
        )}

        {/* YouTube Video / Shorts */}
        {current_platform === 'youtube' && video_id && (
          <div className={`${styles['lumen-social-player-wrap']} ${current_social_type === 'shorts' ? styles['lumen-social-player-wrap-youtube-shorts'] : styles['lumen-social-player-wrap-youtube-video']}`}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video_id}?autoplay=0&rel=0&wmode=opaque`}
              title="YouTube Player"
              className={current_social_type === 'shorts' ? styles['lumen-social-embed-frame-youtube-shorts'] : styles['lumen-social-embed-frame-youtube-video']}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Instagram Player */}
        {current_platform === 'instagram' && instagram_shortcode && (
          <div className={`${styles['lumen-social-player-wrap']} ${current_social_type === 'post' ? styles['lumen-social-player-wrap-instagram-post'] : styles['lumen-social-player-wrap-instagram-reel']}`}>
            <iframe
              src={`https://www.instagram.com/${current_social_type === 'post' ? 'p' : 'reel'}/${instagram_shortcode}/embed/captioned/`}
              title="Instagram Player"
              className={current_social_type === 'post' ? styles['lumen-social-embed-frame-instagram-post'] : styles['lumen-social-embed-frame-instagram-reel']}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              scrolling="no"
            />
          </div>
        )}

        {/* TikTok Player */}
        {current_platform === 'tiktok' && tiktok_id && (
          <div className={`${styles['lumen-social-player-wrap']} ${styles['lumen-social-player-wrap-tiktok']}`}>
            <iframe
              src={`https://www.tiktok.com/embed/v2/${tiktok_id}?lang=en-US`}
              title="TikTok Player"
              className={styles['lumen-social-embed-frame-tiktok']}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              scrolling="no"
            />
          </div>
        )}

        {/* X (Twitter) Official Embed Player */}
        {current_platform === 'x' && (
          <div className={`${styles['lumen-social-player-wrap']} ${styles['lumen-social-player-wrap-x']}`}>
            <iframe
              src={format_x_embed_url(card.url, x_tweet_id)}
              title="X (Twitter) Post"
              className={styles['lumen-social-embed-frame-x']}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              loading="lazy"
            />
          </div>
        )}

        {/* Threads Official Embed Player */}
        {current_platform === 'threads' && (
          <div className={`${styles['lumen-social-player-wrap']} ${styles['lumen-social-player-wrap-threads']}`}>
            <iframe
              src={format_threads_embed_url(card.url, threads_shortcode, threads_username)}
              title="Threads Post"
              className={styles['lumen-social-embed-frame-threads']}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              loading="lazy"
            />
          </div>
        )}

        {/* Pinterest Official Add-ons Embed */}
        {current_platform === 'pinterest' && (
          <LUMEN_pinterest_embed card={card} />
        )}

        {/* Generic Web / Iframe Player Fallback */}
        {current_platform === 'generic' && (
          <div className={styles['lumen-social-player-wrap']}>
            <iframe
              src={card.url || 'about:blank'}
              title="Media Embed"
              className={styles['lumen-social-embed-frame']}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
            />
          </div>
        )}
      </div>

      {/* Card Note (if exist on visual board) */}
      {(card.content || card.description) && (
        <div className={styles['lumen-social-card-note']}>
          <div className={styles['lumen-social-note-header']}>
            <FileText size={10} />
            <span>Note</span>
          </div>
          <div className={styles['lumen-social-note-text']}>
            {card.content || card.description}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className={styles['lumen-social-action-footer']}>
        <span style={{ fontSize: 11, color: 'var(--lumen-text-muted)' }}>
          {card.url ? new URL(card.url.startsWith('http') ? card.url : `https://${card.url}`).hostname.replace('www.', '') : 'embed'}
        </span>

        <a
          href={card.url || '#'}
          target="_blank"
          rel="noreferrer"
          className={styles['lumen-social-visit-cta']}
          onClick={(e) => e.stopPropagation()}
        >
          <span>Open on {platform_label}</span>
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}