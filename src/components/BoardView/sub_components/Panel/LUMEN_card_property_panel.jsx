import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Sliders,
  X,
  Sparkles,
  Tag,
  Trash2,
  Copy,
  Layers,
  Lock,
  Unlock,
  ExternalLink,
  Eye,
  EyeOff,
  Check,
  Plus,
  Maximize2,
  FileText,
  Image as ImageIcon,
  MapPin,
  Code as CodeIcon,
  ListTodo,
  Boxes,
  Link as LinkIcon,
  MessageSquare,
  Compass,
  CheckSquare,
  Square,
  Share2,
  Upload,
  Download,
  TrendingUp,
  Palette as PaletteIcon,
  Table,
  FileCode,
  FolderTree,
  ArrowUp,
  ArrowDown,
  Quote as QuoteIcon,
  Search,
  Navigation,
  Route,
  RefreshCw,
  KeyRound,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Play,
  Pause,
  Clock,
  Type,
  Mic,
  Languages,
  Volume2,
  Globe,
} from 'lucide-react';
import styles from './LUMEN_card_property_panel.module.css';
import {
  LUMEN_card_time_range_section,
  LUMEN_batch_time_range_section,
  LUMEN_board_time_filter_section,
} from './LUMEN_card_time_range_section.jsx';
import {
  activeBoardSignal,
  selectedCardsSignal,
  addCard,
  updateCard,
  clearCardMuseVoiceResult,
  closePropertyPanel,
  deleteCard,
  duplicateCard,
  bringToFront,
  sendToBack,
  createGroupCard,
  isAutoOpenPropertyEnabledSignal,
  toggleAutoOpenProperty,
  showToast,
  openImageViewer,
  setActiveBoard,
  saveCurrentBoardToStore,
  upload_lumen_file,
  MAX_BOARD_FILE_SIZE_MB,
  MAX_BOARD_FILE_SIZE_BYTES,
  unlockedCardsSignal,
  unlockCard,
  lockCard,
  encryptExistingCard,
  decryptCardPermanently,
  changeCardPasskey,
  resolve_card_style,
  FREE_COMMERCIAL_GOOGLE_FONTS,
  googleFontsCatalogSignal,
  ensure_all_google_fonts_loaded,
  search_google_fonts,
  load_google_font,
  get_google_font_css_stack,
  resolve_card_font_family,
} from '../../signals/boardState.js';
import {
  askAiAboutCard,
  runAiCardAction,
  improveImagePromptWithMuse,
  getCardAiActions,
  isCardAiProcessingSignal,
  getSelectedAiModelForTask,
  resolveAiTaskCategoryForAction,
} from '../../signals/aiState.js';
import { openCardCommentsDrawer } from '../../signals/realtimeState.js';
import { resolve_and_parse_gmap_url } from '../Card/LUMEN_geo_card.jsx';
import {
  COMPLETE_UTC_OFFSETS,
  COUNTDOWN_PRESETS,
  normalize_clock_data,
  format_stopwatch_ms,
  format_countdown_ms,
} from '../Card/LUMEN_clock_card.jsx';
import { api_search_places } from '../../utils/lumenApi.js';

const SOUND_TRANSLATE_LANGUAGES = [
  'English',
  'Indonesian',
  'Japanese',
  'Spanish',
  'French',
  'German',
  'Mandarin Chinese',
  'Korean',
  'Arabic',
  'Portuguese',
];

const MUSE_VOICE_PERSONA_OPTIONS = [
  // Google TTS — Female
  { id: 'Kore', label: 'Kore · Google Female (Firm & Clear)', category: 'Google TTS — Female' },
  { id: 'Aoede', label: 'Aoede · Google Female (Breezy & Natural)', category: 'Google TTS — Female' },
  { id: 'Leda', label: 'Leda · Google Female (Youthful & Bright)', category: 'Google TTS — Female' },
  { id: 'Callirrhoe', label: 'Callirrhoe · Google Female (Easy-going & Warm)', category: 'Google TTS — Female' },
  { id: 'Autonoe', label: 'Autonoe · Google Female (Bright & Expressive)', category: 'Google TTS — Female' },
  { id: 'Despina', label: 'Despina · Google Female (Smooth & Calm)', category: 'Google TTS — Female' },
  { id: 'Erinome', label: 'Erinome · Google Female (Articulate & Crisp)', category: 'Google TTS — Female' },
  { id: 'Laomedeia', label: 'Laomedeia · Google Female (Upbeat & Friendly)', category: 'Google TTS — Female' },
  { id: 'Achernar', label: 'Achernar · Google Female (Soft & Gentle)', category: 'Google TTS — Female' },
  { id: 'Sulafat', label: 'Sulafat · Google Female (Warm & Conversational)', category: 'Google TTS — Female' },
  // Google TTS — Male
  { id: 'Puck', label: 'Puck · Google Male (Upbeat & Energetic)', category: 'Google TTS — Male' },
  { id: 'Charon', label: 'Charon · Google Male (Informative & Deep)', category: 'Google TTS — Male' },
  { id: 'Fenrir', label: 'Fenrir · Google Male (Dynamic & Expressive)', category: 'Google TTS — Male' },
  { id: 'Orus', label: 'Orus · Google Male (Firm & Authoritative)', category: 'Google TTS — Male' },
  { id: 'Zephyr', label: 'Zephyr · Google Male (Bright & Crisp)', category: 'Google TTS — Male' },
  { id: 'Iapetus', label: 'Iapetus · Google Male (Clear Studio)', category: 'Google TTS — Male' },
  { id: 'Enceladus', label: 'Enceladus · Google Male (Soft & Natural)', category: 'Google TTS — Male' },
  { id: 'Alnilam', label: 'Alnilam · Google Male (Steady & Confident)', category: 'Google TTS — Male' },
  { id: 'Algieba', label: 'Algieba · Google Male (Smooth & Rich)', category: 'Google TTS — Male' },
  { id: 'Achird', label: 'Achird · Google Male (Friendly & Warm)', category: 'Google TTS — Male' },
  // Google TTS — Neutral & Cloud Neural2
  { id: 'Schedar', label: 'Schedar · Google Neutral (Balanced)', category: 'Google TTS — Neutral & Neural2' },
  { id: 'Gacrux', label: 'Gacrux · Google Neutral (Mature & Calm)', category: 'Google TTS — Neutral & Neural2' },
  { id: 'Pulcherrima', label: 'Pulcherrima · Google Neutral (Forward & Clear)', category: 'Google TTS — Neutral & Neural2' },
  { id: 'Vindemiatrix', label: 'Vindemiatrix · Google Neutral (Gentle & Mindful)', category: 'Google TTS — Neutral & Neural2' },
  { id: 'en-US-Neural2-F', label: 'en-US-Neural2-F · Google Cloud Female', category: 'Google TTS — Neutral & Neural2' },
  { id: 'en-US-Neural2-D', label: 'en-US-Neural2-D · Google Cloud Male', category: 'Google TTS — Neutral & Neural2' },
];

const MUSE_VOICE_PERSONA_CATEGORIES = [
  'Google TTS — Female',
  'Google TTS — Male',
  'Google TTS — Neutral & Neural2',
];

const LEGACY_PANEL_TO_GOOGLE_TTS_MAP = {
  aria: 'Kore',
  aura: 'Kore',
  aurora: 'Aoede',
  nova: 'Aoede',
  vega: 'Aoede',
  breeze: 'Leda',
  coral: 'Callirrhoe',
  luna: 'Despina',
  shimmer: 'Autonoe',
  willow: 'Erinome',
  atlas: 'Fenrir',
  canyon: 'Orus',
  echo: 'Puck',
  ember: 'Enceladus',
  onyx: 'Iapetus',
  orion: 'Charon',
  sol: 'Alnilam',
  zephyr: 'Zephyr',
  alloy: 'Puck',
  fable: 'Schedar',
  sage: 'Gacrux',
  verse: 'Pulcherrima',
};

const normalize_panel_muse_voice_id = (raw_voice) => {
  const raw = String(raw_voice || '').trim();
  if (!raw) return 'Kore';
  const clean_lower = raw.toLowerCase();
  if (LEGACY_PANEL_TO_GOOGLE_TTS_MAP[clean_lower]) {
    return LEGACY_PANEL_TO_GOOGLE_TTS_MAP[clean_lower];
  }
  const matched = MUSE_VOICE_PERSONA_OPTIONS.find(
    (v) => v.id.toLowerCase() === clean_lower
  );
  return matched ? matched.id : 'Kore';
};

const MUSE_VOICE_LANGUAGE_OPTIONS = [
  'Auto-Detect',
  'English',
  'Indonesian',
  'Spanish',
  'French',
  'German',
  'Japanese',
  'Korean',
  'Mandarin Chinese',
  'Arabic',
  'Portuguese',
  'Russian',
  'Hindi',
  'Italian',
  'Dutch',
  'Turkish',
  'Vietnamese',
  'Thai',
  'Tagalog',
  'Malay',
  'Polish',
];
import {
  validate_passkey_policy,
  generate_strong_passkey,
} from '../../utils/card_encryption_guard.js';

const POPULAR_GEO_LANDMARKS = [
  { name: 'Kyoto Pavilion', address: 'Kiyomizu 1-chome, Higashiyama Ward, Kyoto 605-0862, Japan', latitude: 34.9949, longitude: 135.7850, city: 'Kyoto', country: 'Japan', type: 'pavilion' },
  { name: 'Kyoto Tower', address: '721-1 Higashishiokojicho, Shimogyo Ward, Kyoto 600-8216, Japan', latitude: 34.9875, longitude: 135.7593, city: 'Kyoto', country: 'Japan', type: 'tower' },
  { name: 'Fushimi Inari Taisha', address: '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto, Japan', latitude: 34.9671, longitude: 135.7727, city: 'Kyoto', country: 'Japan', type: 'shrine' },
  { name: 'Kiyomizu-dera', address: '1 Chome-294 Kiyomizu, Higashiyama Ward, Kyoto, Japan', latitude: 34.9949, longitude: 135.7850, city: 'Kyoto', country: 'Japan', type: 'temple' },
  { name: 'Arashiyama Bamboo Grove', address: 'Ukyo Ward, Kyoto, Japan', latitude: 35.0169, longitude: 135.6713, city: 'Kyoto', country: 'Japan', type: 'park' },
  { name: 'Kinkaku-ji (Golden Pavilion)', address: '1 Kinkakujicho, Kita Ward, Kyoto, Japan', latitude: 35.0394, longitude: 135.7292, city: 'Kyoto', country: 'Japan', type: 'temple' },
  { name: 'Gion Corner', address: 'Higashiyama Ward, Kyoto, Japan', latitude: 35.0022, longitude: 135.7753, city: 'Kyoto', country: 'Japan', type: 'culture' },
  { name: 'Tokyo Tower', address: '4-chome-2-8 Shibakoen, Minato City, Tokyo 105-0011, Japan', latitude: 35.6586, longitude: 139.7454, city: 'Tokyo', country: 'Japan', type: 'tower' },
  { name: 'Tokyo Skytree', address: '1 Chome-1-2 Oshiage, Sumida City, Tokyo, Japan', latitude: 35.7101, longitude: 139.8107, city: 'Tokyo', country: 'Japan', type: 'tower' },
  { name: 'Shibuya Crossing', address: 'Shibuya City, Tokyo, Japan', latitude: 35.6595, longitude: 139.7005, city: 'Tokyo', country: 'Japan', type: 'square' },
  { name: 'Mount Fuji', address: 'Kitahousan, Fujinomiya, Shizuoka 418-0112, Japan', latitude: 35.3606, longitude: 138.7274, city: 'Shizuoka', country: 'Japan', type: 'mountain' },
  { name: 'Osaka Castle', address: '1-1 Osakajo, Chuo Ward, Osaka, Japan', latitude: 34.6873, longitude: 135.5262, city: 'Osaka', country: 'Japan', type: 'castle' },
  { name: 'Dotonbori', address: 'Chuo Ward, Osaka, Japan', latitude: 34.6687, longitude: 135.5013, city: 'Osaka', country: 'Japan', type: 'district' },
  { name: 'Eiffel Tower', address: 'Champ de Mars, 5 Av. Anatole France, 75007 Paris, France', latitude: 48.8584, longitude: 2.2945, city: 'Paris', country: 'France', type: 'tower' },
  { name: 'Louvre Museum', address: '75001 Paris, France', latitude: 48.8606, longitude: 2.3376, city: 'Paris', country: 'France', type: 'museum' },
  { name: 'Arc de Triomphe', address: 'Pl. Charles de Gaulle, 75008 Paris, France', latitude: 48.8738, longitude: 2.2950, city: 'Paris', country: 'France', type: 'monument' },
  { name: 'Notre-Dame de Paris', address: '6 Parvis Notre-Dame, 75004 Paris, France', latitude: 48.8530, longitude: 2.3499, city: 'Paris', country: 'France', type: 'cathedral' },
  { name: 'Central Park', address: 'New York, NY 10022, United States', latitude: 40.7851, longitude: -73.9683, city: 'New York', country: 'United States', type: 'park' },
  { name: 'Times Square', address: 'Manhattan, NY 10036, United States', latitude: 40.7580, longitude: -73.9855, city: 'New York', country: 'United States', type: 'square' },
  { name: 'Statue of Liberty', address: 'New York, NY 10004, United States', latitude: 40.6892, longitude: -74.0445, city: 'New York', country: 'United States', type: 'monument' },
  { name: 'Empire State Building', address: '20 W 34th St, New York, NY 10001, United States', latitude: 40.7484, longitude: -73.9857, city: 'New York', country: 'United States', type: 'building' },
  { name: 'Golden Gate Bridge', address: 'San Francisco, CA, United States', latitude: 37.8199, longitude: -122.4783, city: 'San Francisco', country: 'United States', type: 'bridge' },
  { name: 'Sydney Opera House', address: 'Bennelong Point, Sydney NSW 2000, Australia', latitude: -33.8568, longitude: 151.2153, city: 'Sydney', country: 'Australia', type: 'theatre' },
  { name: 'Sydney Harbour Bridge', address: 'Sydney NSW, Australia', latitude: -33.8523, longitude: 151.2108, city: 'Sydney', country: 'Australia', type: 'bridge' },
  { name: 'Colosseum', address: 'Piazza del Colosseo, 1, 00184 Roma RM, Italy', latitude: 41.8902, longitude: 12.4922, city: 'Rome', country: 'Italy', type: 'historic' },
  { name: 'Trevi Fountain', address: 'Piazza di Trevi, 00187 Roma RM, Italy', latitude: 41.9009, longitude: 12.4833, city: 'Rome', country: 'Italy', type: 'fountain' },
  { name: 'Duomo di Milano', address: 'P.za del Duomo, 20122 Milano MI, Italy', latitude: 45.4642, longitude: 9.1919, city: 'Milan', country: 'Italy', type: 'cathedral' },
  { name: 'Marina Bay Sands', address: '10 Bayfront Ave, Singapore 018956', latitude: 1.2834, longitude: 103.8607, city: 'Singapore', country: 'Singapore', type: 'resort' },
  { name: 'Gardens by the Bay', address: '18 Marina Gardens Dr, Singapore 018953', latitude: 1.2816, longitude: 103.8636, city: 'Singapore', country: 'Singapore', type: 'park' },
  { name: 'Big Ben', address: 'Westminster, London SW1A 0AA, United Kingdom', latitude: 51.5007, longitude: -0.1246, city: 'London', country: 'United Kingdom', type: 'clock_tower' },
  { name: 'Tower Bridge', address: 'Tower Bridge Rd, London SE1 2UP, United Kingdom', latitude: 51.5055, longitude: -0.0754, city: 'London', country: 'United Kingdom', type: 'bridge' },
  { name: 'London Eye', address: 'Riverside Building, County Hall, London SE1 7PB, UK', latitude: 51.5033, longitude: -0.1195, city: 'London', country: 'United Kingdom', type: 'attraction' },
  { name: 'Sagrada Familia', address: 'Carrer de Mallorca, 401, 08013 Barcelona, Spain', latitude: 41.4036, longitude: 2.1744, city: 'Barcelona', country: 'Spain', type: 'church' },
  { name: 'Park Güell', address: '08024 Barcelona, Spain', latitude: 41.4145, longitude: 2.1527, city: 'Barcelona', country: 'Spain', type: 'park' },
  { name: 'Burj Khalifa', address: '1 Sheikh Mohammed bin Rashid Blvd, Dubai, United Arab Emirates', latitude: 25.1972, longitude: 55.2744, city: 'Dubai', country: 'UAE', type: 'skyscraper' },
  { name: 'Taj Mahal', address: 'Dharmapuri, Forest Colony, Tajganj, Agra, Uttar Pradesh 282001, India', latitude: 27.1751, longitude: 78.0421, city: 'Agra', country: 'India', type: 'monument' },
  { name: 'Monas (National Monument)', address: 'Gambir, Central Jakarta, Indonesia', latitude: -6.1754, longitude: 106.8272, city: 'Jakarta', country: 'Indonesia', type: 'monument' },
  { name: 'Tanah Lot Temple', address: 'Beraban, Kediri, Tabanan Regency, Bali 82121, Indonesia', latitude: -8.6212, longitude: 115.0868, city: 'Bali', country: 'Indonesia', type: 'temple' },
  { name: 'Ubud Monkey Forest', address: 'Jl. Monkey Forest, Ubud, Gianyar, Bali, Indonesia', latitude: -8.5188, longitude: 115.2585, city: 'Bali', country: 'Indonesia', type: 'reserve' },
  { name: 'Borobudur Temple', address: 'Jl. Badrawati, Kw. Candi Borobudur, Magelang, Central Java, Indonesia', latitude: -7.6079, longitude: 110.2038, city: 'Magelang', country: 'Indonesia', type: 'temple' },
  { name: 'Prambanan Temple', address: 'Bokoharjo, Prambanan, Sleman Regency, DI Yogyakarta, Indonesia', latitude: -7.7520, longitude: 110.4915, city: 'Yogyakarta', country: 'Indonesia', type: 'temple' },
  { name: 'Grand Palace', address: 'Na Phra Lan Rd, Phra Borom Maha Ratchawang, Bangkok, Thailand', latitude: 13.7500, longitude: 100.4914, city: 'Bangkok', country: 'Thailand', type: 'palace' },
  { name: 'Gyeongbokgung Palace', address: '161 Sajik-ro, Jongno District, Seoul, South Korea', latitude: 37.5796, longitude: 126.9770, city: 'Seoul', country: 'South Korea', type: 'palace' },
  { name: 'Taipei 101', address: 'No. 7, Section 5, Xinyi Rd, Xinyi District, Taipei City, Taiwan', latitude: 25.0339, longitude: 121.5645, city: 'Taipei', country: 'Taiwan', type: 'skyscraper' },
  { name: 'Victoria Peak', address: 'The Peak, Hong Kong', latitude: 22.2759, longitude: 114.1455, city: 'Hong Kong', country: 'Hong Kong', type: 'viewpoint' },
  { name: 'Great Wall of China', address: 'Huairou District, Beijing, China', latitude: 40.4319, longitude: 116.5704, city: 'Beijing', country: 'China', type: 'historic' },
  { name: 'Brandenburg Gate', address: 'Pariser Platz, 10117 Berlin, Germany', latitude: 52.5163, longitude: 13.3777, city: 'Berlin', country: 'Germany', type: 'monument' },
  { name: 'Rijksmuseum', address: 'Museumstraat 1, 1071 XX Amsterdam, Netherlands', latitude: 52.3600, longitude: 4.8852, city: 'Amsterdam', country: 'Netherlands', type: 'museum' },
];

const filter_popular_landmarks = (query) => {
  if (!query || !query.trim()) return [];
  const q = query.toLowerCase().trim();
  return POPULAR_GEO_LANDMARKS.filter((p) => {
    return (
      p.name.toLowerCase().includes(q) ||
      (p.address && p.address.toLowerCase().includes(q)) ||
      (p.city && p.city.toLowerCase().includes(q)) ||
      (p.country && p.country.toLowerCase().includes(q))
    );
  }).map((p, idx) => ({
    place_id: `landmark_${idx}_${p.name.replace(/\s+/g, '_')}`,
    name: p.name,
    display_name: p.address,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    type: p.type || 'landmark',
    city: p.city,
    country: p.country,
  }));
};

const COLOR_PRESETS = [
  { name: 'white', hex: '#ffffff', label: 'White' },
  { name: 'yellow', hex: '#fef08a', label: 'Yellow' },
  { name: 'teal', hex: '#99f6e4', label: 'Teal' },
  { name: 'blue', hex: '#bfdbfe', label: 'Blue' },
  { name: 'purple', hex: '#e9d5ff', label: 'Purple' },
  { name: 'rose', hex: '#fecdd3', label: 'Rose' },
  { name: 'peach', hex: '#fed7aa', label: 'Peach' },
  { name: 'slate', hex: '#f1f5f9', label: 'Slate' },
  { name: 'emerald', hex: '#a7f3d0', label: 'Emerald' },
  { name: 'green', hex: '#bbf7d0', label: 'Green' },
  { name: 'amber', hex: '#fde68a', label: 'Amber' },
  { name: 'orange', hex: '#fdba74', label: 'Orange' },
  { name: 'red', hex: '#fecaca', label: 'Red' },
  { name: 'indigo', hex: '#c7d2fe', label: 'Indigo' },
  { name: 'cyan', hex: '#a5f3fc', label: 'Cyan' },
  { name: 'gray', hex: '#e2e8f0', label: 'Gray' },
];

const SUGGESTED_TAGS = [
  { text: 'Design', color: '#6366f1' },
  { text: 'Review', color: '#eab308' },
  { text: 'Priority', color: '#ef4444' },
  { text: 'In Progress', color: '#3b82f6' },
  { text: 'Todo', color: '#8b5cf6' },
  { text: 'Moodboard', color: '#ec4899' },
  { text: 'Architecture', color: '#10b981' },
  { text: 'Feedback', color: '#f97316' },
];

const CODE_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'html',
  'css',
  'json',
  'sql',
  'bash',
  'rust',
  'go',
  'markdown',
];

const STOCK_PRESETS = [
  'MAPI.JK',
  'BBCA.JK',
  'TLKM.JK',
  'BBRI.JK',
  'ASII.JK',
  'AAPL',
  'NVDA',
  'TSLA',
  'MSFT',
  'GOOGL',
  'AMZN',
];

const STOCK_RANGES = [
  { key: '1d', label: '1D' },
  { key: '5d', label: '5D' },
  { key: '1mo', label: '1M' },
  { key: '6mo', label: '6M' },
  { key: 'ytd', label: 'YTD' },
  { key: '1y', label: '1Y' },
  { key: '5y', label: '5Y' },
  { key: 'max', label: 'MAX' },
];

const CURATED_PALETTES = [
  {
    name: 'Architectural Earth & Travertine',
    colors: [
      { id: 'c1', hex: '#2A2421', name: 'Charcoal Umber', role: 'Base' },
      { id: 'c2', hex: '#7D6B5D', name: 'Warm Taupe', role: 'Mid' },
      { id: 'c3', hex: '#C28460', name: 'Terracotta', role: 'Accent' },
      { id: 'c4', hex: '#D7C4B7', name: 'Travertine', role: 'Neutral' },
      { id: 'c5', hex: '#F4ECE4', name: 'Raw Linen', role: 'Light' },
    ],
  },
  {
    name: 'Nordic Pine & Sage',
    colors: [
      { id: 'c1', hex: '#162A24', name: 'Deep Spruce', role: 'Base' },
      { id: 'c2', hex: '#2C5E43', name: 'Forest Green', role: 'Primary' },
      { id: 'c3', hex: '#688F74', name: 'Earthy Sage', role: 'Mid' },
      { id: 'c4', hex: '#B5C99A', name: 'Pale Moss', role: 'Accent' },
      { id: 'c5', hex: '#F0F3E8', name: 'Birch Bark', role: 'Light' },
    ],
  },
  {
    name: 'Kyoto Indigo & Ochre',
    colors: [
      { id: 'c1', hex: '#14213D', name: 'Midnight Indigo', role: 'Primary' },
      { id: 'c2', hex: '#3A506B', name: 'Slate Wave', role: 'Secondary' },
      { id: 'c3', hex: '#E5A93C', name: 'Raw Ochre', role: 'Accent' },
      { id: 'c4', hex: '#E0DDCF', name: 'Washi Paper', role: 'Neutral' },
      { id: 'c5', hex: '#FAF8F5', name: 'Pure Chalk', role: 'Base' },
    ],
  },
  {
    name: 'Vibrant Sunset & Neon Coral',
    colors: [
      { id: 'c1', hex: '#4A154B', name: 'Deep Aubergine', role: 'Base' },
      { id: 'c2', hex: '#E01E5A', name: 'Neon Rose', role: 'Primary' },
      { id: 'c3', hex: '#ECB22E', name: 'Golden Marigold', role: 'Accent' },
      { id: 'c4', hex: '#36C5F0', name: 'Electric Sky', role: 'Mid' },
      { id: 'c5', hex: '#2EB67D', name: 'Vivid Mint', role: 'Light' },
    ],
  },
];

// Helper: Normalize images array into array of { id, url, caption }
const normalize_card_slides = (card) => {
  if (!card) return [];
  if (Array.isArray(card.images) && card.images.length > 0) {
    return card.images.map((item, idx) => {
      if (typeof item === 'string') {
        return {
          id: `slide_${idx}`,
          url: item,
          caption: card.caption || '',
        };
      }
      return {
        ...item,
        id: item.id || `slide_${idx}`,
        url: item.url || '',
        caption: item.caption || '',
      };
    });
  }
  if (card.imageUrl) {
    return [
      {
        id: 'slide_0',
        url: card.imageUrl,
        caption: card.caption || '',
        ...(card.file_id ? { file_id: card.file_id } : {}),
        ...(card.output_format ? { output_format: card.output_format } : {}),
      },
    ];
  }
  return [];
};

export function LUMEN_card_property_panel() {
  useSignals();
  const [active_tab, set_active_tab] = useState('content'); // 'content' | 'encryption' | 'style' | 'layout' | 'tags'
  const [new_task_text, set_new_task_text] = useState('');
  const [new_tag_text, set_new_tag_text] = useState('');
  const [new_tag_color, set_new_tag_color] = useState('#2563eb');
  const [new_slide_url, set_new_slide_url] = useState('');
  const [geo_search_query, set_geo_search_query] = useState('');
  const [geo_search_results, set_geo_search_results] = useState([]);
  const [is_searching_places, set_is_searching_places] = useState(false);
  const [is_geo_search_open, set_is_geo_search_open] = useState(false);
  const [geo_url_input, set_geo_url_input] = useState('');
  const [is_resolving_geo_url, set_is_resolving_geo_url] = useState(false);

  // Encryption Tab States
  const [enc_new_passkey, set_enc_new_passkey] = useState('');
  const [enc_confirm_passkey, set_enc_confirm_passkey] = useState('');
  const [enc_passkey_hint, set_enc_passkey_hint] = useState('');
  const [show_enc_new_passkey, set_show_enc_new_passkey] = useState(false);
  const [enc_error_msg, set_enc_error_msg] = useState('');
  const [is_encrypting_card, set_is_encrypting_card] = useState(false);

  const [panel_unlock_passkey, set_panel_unlock_passkey] = useState('');
  const [panel_unlock_show, set_panel_unlock_show] = useState(false);
  const [panel_unlock_error, set_panel_unlock_error] = useState('');
  const [is_unlocking_in_panel, set_is_unlocking_in_panel] = useState(false);

  const [change_old_passkey, set_change_old_passkey] = useState('');
  const [change_new_passkey, set_change_new_passkey] = useState('');
  const [change_confirm_passkey, set_change_confirm_passkey] = useState('');
  const [change_new_hint, set_change_new_hint] = useState('');
  const [show_change_form, set_show_change_form] = useState(false);
  const [change_error_msg, set_change_error_msg] = useState('');
  const [is_changing_passkey, set_is_changing_passkey] = useState(false);

  const [show_decrypt_confirm, set_show_decrypt_confirm] = useState(false);
  const [decrypt_passkey_input, set_decrypt_passkey_input] = useState('');
  const [decrypt_error_msg, set_decrypt_error_msg] = useState('');
  const [is_decrypting_permanently, set_is_decrypting_permanently] = useState(false);

  // Dimension input states separated from real card display bottom limits
  const [width_input, set_width_input] = useState('');
  const [height_input, set_height_input] = useState('');

  // Free Commercial Google Fonts filter & custom input state
  const [font_category_filter, set_font_category_filter] = useState('all');
  const [font_search_query, set_font_search_query] = useState('');
  const [custom_google_font_input, set_custom_google_font_input] = useState('');
  const [content_font_search, set_content_font_search] = useState('');
  const [batch_font_search, set_batch_font_search] = useState('');
  const [font_visible_limit, set_font_visible_limit] = useState(40);

  const slide_file_input_ref = useRef(null);
  const property_file_input_ref = useRef(null);
  const [is_property_uploading, set_is_property_uploading] = useState(false);
  const [is_property_dragging, set_is_property_dragging] = useState(false);
  const [is_carousel_drag_over, set_is_carousel_drag_over] = useState(false);
  const [is_property_fetching_link, set_is_property_fetching_link] = useState(false);
  const [panel_ai_popup_action, set_panel_ai_popup_action] = useState(null);
  const [panel_ai_prompt_input, set_panel_ai_prompt_input] = useState('');
  const [panel_tts_voice, set_panel_tts_voice] = useState('aria');
  const [panel_tts_lang, set_panel_tts_lang] = useState('Auto-Detect');
  const [panel_use_ref_image, set_panel_use_ref_image] = useState(false);
  const [panel_ref_strength, set_panel_ref_strength] = useState(0.45);
  const [panel_ai_image_size, set_panel_ai_image_size] = useState('auto');
  const [panel_ai_output_format, set_panel_ai_output_format] = useState('jpg');
  const [panel_ai_reasoning_strength, set_panel_ai_reasoning_strength] = useState('high');
  const [panel_ai_image_search, set_panel_ai_image_search] = useState(true);
  const [panel_ai_web_search, set_panel_ai_web_search] = useState(true);
  const [panel_ai_shell, set_panel_ai_shell] = useState(true);
  const [panel_ai_auto_improve_prompt, set_panel_ai_auto_improve_prompt] = useState(true);
  const [is_panel_improving_prompt, set_is_panel_improving_prompt] = useState(false);
  const [panel_code_prompt_input, set_panel_code_prompt_input] = useState('');
  const [panel_code_create_new_tab, set_panel_code_create_new_tab] = useState(false);
  const geo_debounce_timer_ref = useRef(null);
  const geo_request_id_ref = useRef(0);

  useEffect(() => {
    ensure_all_google_fonts_loaded();
    return () => {
      if (geo_debounce_timer_ref.current) {
        clearTimeout(geo_debounce_timer_ref.current);
      }
    };
  }, []);

  const selected_ids = selectedCardsSignal.value || [];
  const active_board = activeBoardSignal.value || {};
  const cards = active_board.cards || [];
  const selected_card = cards.find((c) => c.id === selected_ids[0]);

  useEffect(() => {
    if (selected_card) {
      set_width_input(selected_card.width !== undefined && selected_card.width !== null ? String(selected_card.width) : '');
      set_height_input(selected_card.height !== undefined && selected_card.height !== null ? String(selected_card.height) : '');
      set_panel_tts_voice(normalize_panel_muse_voice_id(selected_card.tts_voice_persona));
      set_panel_tts_lang(selected_card.tts_language || 'Auto-Detect');
    } else {
      set_width_input('');
      set_height_input('');
    }
  }, [selected_card?.id, selected_card?.width, selected_card?.height, selected_card?.tts_voice_persona, selected_card?.tts_language]);

  // Geo / Places Search Query Handler with instant local matches, debounced network API, and racing prevention
  const handle_search_places_query = (query_text) => {
    set_geo_search_query(query_text);
    set_is_geo_search_open(true);

    const trimmed = (query_text || '').trim();
    if (!trimmed) {
      if (geo_debounce_timer_ref.current) {
        clearTimeout(geo_debounce_timer_ref.current);
      }
      set_geo_search_results([]);
      set_is_searching_places(false);
      return;
    }

    // 1. Synchronous Instant Local Filter (0ms latency - keeps UI immediately populated)
    const local_matches = filter_popular_landmarks(trimmed);
    if (local_matches.length > 0) {
      set_geo_search_results(local_matches);
    }

    // 2. Clear pending debounce timer
    if (geo_debounce_timer_ref.current) {
      clearTimeout(geo_debounce_timer_ref.current);
    }

    // 3. Increment request ID to ignore stale out-of-order responses
    const current_request_id = ++geo_request_id_ref.current;
    set_is_searching_places(true);

    geo_debounce_timer_ref.current = setTimeout(async () => {
      try {
        const remote_results = await api_search_places(trimmed);

        // Discard stale out-of-order response
        if (current_request_id !== geo_request_id_ref.current) {
          return;
        }

        const fresh_local = filter_popular_landmarks(trimmed);
        const combined = [...fresh_local];

        (remote_results || []).forEach((r) => {
          if (
            !combined.some(
              (c) =>
                Math.abs(c.latitude - r.latitude) < 0.002 &&
                Math.abs(c.longitude - r.longitude) < 0.002
            )
          ) {
            combined.push(r);
          }
        });

        if (combined.length > 0) {
          set_geo_search_results(combined);
        } else if (fresh_local.length > 0) {
          set_geo_search_results(fresh_local);
        } else {
          set_geo_search_results([]);
        }
      } catch (err) {
        console.warn('Place search error:', err);
      } finally {
        if (current_request_id === geo_request_id_ref.current) {
          set_is_searching_places(false);
        }
      }
    }, 220);
  };

  const handle_create_geo_from_place = (place) => {
    if (!place) return;
    const viewport = active_board.viewport || { panX: 0, panY: 0, zoom: 1 };
    const center_x = Math.round((-viewport.panX + (typeof window !== 'undefined' ? window.innerWidth / 2 : 400) - 190) / (viewport.zoom || 1));
    const center_y = Math.round((-viewport.panY + (typeof window !== 'undefined' ? window.innerHeight / 2 : 300) - 150) / (viewport.zoom || 1));

    const gmap_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((place.name || '') + ' ' + (place.address || ''))}`;
    const new_card_id = `card_geo_${Date.now()}`;

    addCard({
      id: new_card_id,
      type: 'geo',
      title: place.name || 'Location Pin',
      location_name: place.name || 'Location Pin',
      address: place.address || place.display_name || '',
      latitude: place.latitude,
      longitude: place.longitude,
      zoom: 15,
      url: gmap_url,
      destinations: [
        {
          id: `dest_${Date.now()}`,
          name: place.name || 'Location Pin',
          address: place.address || place.display_name || '',
          latitude: place.latitude,
          longitude: place.longitude,
        },
      ],
      x: center_x,
      y: center_y,
      width: 384,
      height: 420,
      color: 'blue',
    });

    selectedCardsSignal.value = [new_card_id];
    set_geo_search_query('');
    set_geo_search_results([]);
    showToast(`Created Map Card for "${place.name}"`);
  };

  // Handle No Card Selected
  if (selected_ids.length === 0) {
    return (
      <aside
        className={styles['lumen-property-panel'] || styles.lumenPropertyPanel}
        aria-label="Card Properties"
      >
        <div className={styles['lumen-property-header'] || styles.lumenPropertyHeader}>
          <div className={styles['lumen-property-title-wrap'] || styles.lumenPropertyTitleWrap}>
            <div className={styles['lumen-property-title'] || styles.lumenPropertyTitle}>
              <Sliders size={14} />
              <span>Card Properties</span>
            </div>
          </div>
          <div className={styles['lumen-property-header-actions'] || styles.lumenPropertyHeaderActions}>
            <button
              type="button"
              className={`${styles['lumen-property-auto-toggle'] || styles.lumenPropertyAutoToggle} ${
                isAutoOpenPropertyEnabledSignal.value
                  ? (styles['lumen-property-auto-toggle-active'] || styles.lumenPropertyAutoToggleActive)
                  : ''
              }`}
              onClick={() => {
                const next_val = toggleAutoOpenProperty();
                showToast(
                  next_val
                    ? 'Auto-open card properties enabled'
                    : 'Auto-open card properties disabled'
                );
              }}
              title={
                isAutoOpenPropertyEnabledSignal.value
                  ? 'Auto-open on selection is ON. Click to turn OFF.'
                  : 'Auto-open on selection is OFF. Click to turn ON.'
              }
            >
              <span>Auto: {isAutoOpenPropertyEnabledSignal.value ? 'ON' : 'OFF'}</span>
            </button>
            <button
              type="button"
              className={styles['lumen-property-close-btn'] || styles.lumenPropertyCloseBtn}
              onClick={closePropertyPanel}
              title="Close Properties"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className={styles['lumen-property-body'] || styles.lumenPropertyBody}>
          <div style={{ textAlign: 'center', padding: '16px 8px 8px' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(37, 99, 235, 0.08)',
                color: 'var(--lumen-accent, #2563eb)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <Sliders size={20} />
            </div>
            <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600 }}>
              No Card Selected
            </h4>
            <p
              style={{
                fontSize: 12,
                color: 'var(--lumen-text-muted, #94a3b8)',
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              Click any card on the visual board, or choose a card below to inspect and edit its full properties.
            </p>
          </div>

          {/* Board Time Range / Due Date Filter */}
          <div style={{ marginTop: 8 }}>
            <LUMEN_board_time_filter_section />
          </div>

          {/* Quick Action: Search Places & Add Map Card */}
          <div className={styles['lumen-property-section'] || styles.lumenPropertySection} style={{ marginTop: 8 }}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={13} color="var(--lumen-accent, #2563eb)" />
                <span>Search Places & Add Map Card</span>
              </div>
            </div>

            <div className={styles['lumen-property-geo-search-wrap'] || styles.lumenPropertyGeoSearchWrap}>
              <div className={styles['lumen-property-geo-search-input-box'] || styles.lumenPropertyGeoSearchInputBox}>
                <Search size={13} color="var(--lumen-text-muted, #94a3b8)" />
                <input
                  type="text"
                  value={geo_search_query}
                  onChange={(e) => handle_search_places_query(e.target.value)}
                  onFocus={() => set_is_geo_search_open(true)}
                  placeholder="Search place to create map card (e.g. Kyoto Tower, Paris)..."
                  className={styles['lumen-property-geo-search-input'] || styles.lumenPropertyGeoSearchInput}
                />
                {is_searching_places && (
                  <span className={styles['lumen-property-geo-spinner'] || styles.lumenPropertyGeoSpinner} title="Searching..." />
                )}
                {geo_search_query && (
                  <button
                    type="button"
                    onClick={() => {
                      set_geo_search_query('');
                      set_geo_search_results([]);
                      set_is_geo_search_open(false);
                    }}
                    className={styles['lumen-property-geo-search-clear'] || styles.lumenPropertyGeoSearchClear}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Autocomplete Search Results Dropdown - Stays open and never vanishes while typing */}
              {is_geo_search_open && (geo_search_query.trim().length > 0 || geo_search_results.length > 0) && (
                <div
                  className={styles['lumen-property-geo-search-results'] || styles.lumenPropertyGeoSearchResults}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {geo_search_results.length > 0 ? (
                    geo_search_results.map((place, p_idx) => (
                      <button
                        key={place.place_id || `${place.name}_${p_idx}`}
                        type="button"
                        className={styles['lumen-property-geo-result-item'] || styles.lumenPropertyGeoResultItem}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handle_create_geo_from_place(place)}
                      >
                        <div className={styles['lumen-property-geo-result-header'] || styles.lumenPropertyGeoResultHeader}>
                          <span className={styles['lumen-property-geo-result-name'] || styles.lumenPropertyGeoResultName}>
                            {place.name}
                          </span>
                          <span className={styles['lumen-property-geo-result-type'] || styles.lumenPropertyGeoResultType}>
                            + Create Card
                          </span>
                        </div>
                        <span className={styles['lumen-property-geo-result-addr'] || styles.lumenPropertyGeoResultAddr}>
                          {place.address || place.display_name}
                        </span>
                        <span className={styles['lumen-property-geo-result-coords'] || styles.lumenPropertyGeoResultCoords}>
                          {typeof place.latitude === 'number' ? place.latitude.toFixed(4) : ''}°, {typeof place.longitude === 'number' ? place.longitude.toFixed(4) : ''}°
                        </span>
                      </button>
                    ))
                  ) : is_searching_places ? (
                    <div className={styles['lumen-property-geo-search-loading'] || styles.lumenPropertyGeoSearchLoading}>
                      <span className={styles['lumen-property-geo-spinner'] || styles.lumenPropertyGeoSpinner} />
                      <span>Searching live global places for "{geo_search_query}"...</span>
                    </div>
                  ) : (
                    <div className={styles['lumen-property-geo-no-results'] || styles.lumenPropertyGeoNoResults}>
                      <span>No places found for "{geo_search_query}"</span>
                      <button
                        type="button"
                        className={styles['lumen-property-geo-custom-pin-btn'] || styles.lumenPropertyGeoCustomPinBtn}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          handle_create_geo_from_place({
                            name: geo_search_query.trim(),
                            address: geo_search_query.trim(),
                            latitude: 35.0116,
                            longitude: 135.7681,
                          })
                        }
                      >
                        + Create as Custom Pin
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {cards.length > 0 && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span>Cards on this board ({cards.length})</span>
                <span style={{ fontSize: 10, color: 'var(--lumen-text-muted)' }}>Drag to canvas</span>
              </div>
              <div className={styles['lumen-property-card-list'] || styles.lumenPropertyCardList}>
                {cards.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    draggable={true}
                    className={styles['lumen-property-card-item'] || styles.lumenPropertyCardItem}
                    onClick={() => {
                      selectedCardsSignal.value = [c.id];
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectedCardsSignal.value = [c.id];
                      }
                    }}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/lumen-card-id', c.id);
                      e.dataTransfer.setData('text/plain', c.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    title={`Click to select or drag onto canvas to reposition: ${c.title || c.type}`}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor:
                          COLOR_PRESETS.find((p) => p.name === c.color)?.hex || '#cbd5e1',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: 500,
                      }}
                    >
                      {c.title || `Untitled ${c.type || 'Card'}`}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--lumen-text-muted, #94a3b8)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {c.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // Handle Multi-Selection Mode (2+ Cards)
  if (selected_ids.length > 1) {
    const multi_count = selected_ids.length;

    const handle_batch_color = (color_name) => {
      selected_ids.forEach((id) => {
        updateCard(id, { color: color_name });
      });
      showToast(`Updated color for ${multi_count} cards`);
    };

    const handle_batch_delete = () => {
      selected_ids.forEach((id) => {
        deleteCard(id);
      });
      selectedCardsSignal.value = [];
      showToast(`Deleted ${multi_count} cards`);
    };

    const handle_batch_lock = (lock_state) => {
      selected_ids.forEach((id) => {
        updateCard(id, { locked: lock_state });
      });
      showToast(`${lock_state ? 'Locked' : 'Unlocked'} ${multi_count} cards`);
    };

    const handle_group_selection = () => {
      createGroupCard({ card_ids: selected_ids });
      showToast(`Grouped ${multi_count} cards into a container frame`);
    };

    const handle_batch_card_style = (style_mode) => {
      const next_val = style_mode === 'board_default' ? null : style_mode;
      selected_ids.forEach((id) => {
        updateCard(id, { card_style: next_val });
      });
      saveCurrentBoardToStore();
      if (style_mode === 'board_default') {
        showToast(`Reset ${multi_count} cards to Board Default style`);
      } else {
        showToast(
          `Set ${multi_count} cards to ${style_mode === 'seamless' ? 'Seamless' : 'Full'} style`
        );
      }
    };

    const board_default_card_style =
      active_board?.board_setting?.card_style === 'seamless' ? 'seamless' : 'full';

    return (
      <aside
        className={styles['lumen-property-panel'] || styles.lumenPropertyPanel}
        aria-label="Multi Card Properties"
        onWheel={(e) => e.stopPropagation()}
        data-lumen-menu="true"
      >
        <div className={styles['lumen-property-header'] || styles.lumenPropertyHeader}>
          <div className={styles['lumen-property-title-wrap'] || styles.lumenPropertyTitleWrap}>
            <div className={styles['lumen-property-title'] || styles.lumenPropertyTitle}>
              <Boxes size={14} color="var(--lumen-accent)" />
              <span>Multi-Card Selection</span>
            </div>
            <span className={styles['lumen-property-type-tag'] || styles.lumenPropertyTypeTag}>
              {multi_count} Cards
            </span>
          </div>
          <div className={styles['lumen-property-header-actions'] || styles.lumenPropertyHeaderActions}>
            <button
              type="button"
              className={styles['lumen-property-close-btn'] || styles.lumenPropertyCloseBtn}
              onClick={closePropertyPanel}
              title="Close Properties"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className={styles['lumen-property-body'] || styles.lumenPropertyBody}>
          <div className={styles['lumen-property-multi-banner'] || styles.lumenPropertyMultiBanner}>
            <Boxes size={16} />
            <span>{multi_count} cards currently selected</span>
          </div>

          <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <span>Batch Organization</span>
            </div>
            <button
              type="button"
              className={styles['lumen-property-add-btn'] || styles.lumenPropertyAddBtn}
              onClick={handle_group_selection}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Boxes size={14} />
              <span>Group Cards into Frame</span>
            </button>
          </div>

          <LUMEN_batch_time_range_section selected_ids={selected_ids} />

          <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <span>Batch Card Style</span>
              <span className={styles['lumen-property-label-hint'] || styles.lumenPropertyLabelHint}>
                Board: {board_default_card_style === 'seamless' ? 'Seamless' : 'Full'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                onClick={() => handle_batch_card_style('board_default')}
                style={{ flex: 1, fontSize: 11, padding: '6px 8px' }}
                title="Use the board's default card style"
              >
                <span>Board Default</span>
              </button>
              <button
                type="button"
                className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                onClick={() => handle_batch_card_style('full')}
                style={{ flex: 1, fontSize: 11, padding: '6px 8px' }}
                title="Force Full style on all selected cards"
              >
                <span>Full</span>
              </button>
              <button
                type="button"
                className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                onClick={() => handle_batch_card_style('seamless')}
                style={{ flex: 1, fontSize: 11, padding: '6px 8px' }}
                title="Force Seamless style on all selected cards"
              >
                <span>Seamless</span>
              </button>
            </div>
          </div>

          <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Type size={13} color="var(--lumen-accent, #2563eb)" />
                <span>Batch Google Font (Free Commercial)</span>
              </span>
              <span className={styles['lumen-property-label-hint'] || styles.lumenPropertyLabelHint}>
                {(googleFontsCatalogSignal.value || FREE_COMMERCIAL_GOOGLE_FONTS).length} Fonts
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                type="text"
                value={batch_font_search}
                onChange={(e) => set_batch_font_search(e.target.value)}
                placeholder="Search free commercial Google Fonts..."
                className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                style={{ fontSize: 11.5 }}
              />
              <select
                defaultValue="board_default"
                onChange={(e) => {
                  const val = e.target.value;
                  const next_font = val === 'board_default' ? null : val;
                  if (next_font) load_google_font(next_font);
                  selected_ids.forEach((id) => {
                    updateCard(id, { font_family: next_font });
                  });
                  saveCurrentBoardToStore();
                  showToast(
                    next_font
                      ? `Applied "${next_font}" Google Font to ${multi_count} cards`
                      : `Reset ${multi_count} cards to Board Default font`
                  );
                }}
                className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                style={{ fontWeight: 500 }}
              >
                <option value="board_default">
                  Board Default ({active_board?.board_setting?.font_family || 'System / Inter'})
                </option>
                {search_google_fonts(batch_font_search, 'all').map((gf) => (
                  <option key={gf.family} value={gf.family}>
                    {gf.family} — {gf.category} ({gf.license})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <span>Batch Color Palette</span>
            </div>
            <div className={styles['lumen-color-palette'] || styles.lumenColorPalette}>
              {COLOR_PRESETS.map((p) => (
                <div
                  key={p.name}
                  className={styles['lumen-color-swatch'] || styles.lumenColorSwatch}
                  style={{ backgroundColor: p.hex }}
                  onClick={() => handle_batch_color(p.name)}
                  title={`Apply ${p.label} to all selected`}
                />
              ))}
            </div>
          </div>

          <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <span>Batch Protection</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                onClick={() => handle_batch_lock(true)}
                style={{ flex: 1 }}
              >
                <Lock size={12} />
                <span>Lock All</span>
              </button>
              <button
                type="button"
                className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                onClick={() => handle_batch_lock(false)}
                style={{ flex: 1 }}
              >
                <Unlock size={12} />
                <span>Unlock All</span>
              </button>
            </div>
          </div>
        </div>

        <div className={styles['lumen-property-footer-actions'] || styles.lumenPropertyFooterActions}>
          <button
            type="button"
            className={styles['lumen-property-danger-btn'] || styles.lumenPropertyDangerBtn}
            onClick={handle_batch_delete}
          >
            <Trash2 size={13} />
            <span>Delete Selected Cards ({multi_count})</span>
          </button>
        </div>
      </aside>
    );
  }

  // Handle Single Card Selected
  if (!selected_card) return null;

  // General Change Handlers
  const handle_title_change = (e) => {
    updateCard(selected_card.id, { title: e.target.value });
  };

  const handle_content_change = (e) => {
    const val = e.target.value;
    if (selected_card.type === 'image') {
      updateCard(selected_card.id, {
        content: val,
        ai_notes: val,
      });
    } else {
      updateCard(selected_card.id, { content: val });
    }
  };

  const handle_description_change = (e) => {
    updateCard(selected_card.id, { description: e.target.value });
  };

  const handle_url_change = (e) => {
    const next_url = e.target.value;
    updateCard(selected_card.id, { url: next_url });
    if (selected_card.type === 'geo' && next_url.trim()) {
      handle_apply_geo_url(next_url.trim());
    }
  };

  const handle_refresh_weblink_metadata = async () => {
    if (!selected_card?.url) return;
    const clean_url = selected_card.url.trim();
    if (!clean_url) return;
    try {
      set_is_property_fetching_link(true);
      const res = await fetch(`/api/weblink/metadata?url=${encodeURIComponent(clean_url)}`);
      if (!res.ok) throw new Error('Failed to fetch metadata');
      const data = await res.json();
      if (data) {
        const updates = {
          meta_resolved_url: clean_url,
          web_status: data.status || 200,
          web_status_text: data.status_text || '200 OK',
          web_is_live: data.is_live !== false,
          domain: data.domain || clean_url.replace(/^https?:\/\//, '').split('/')[0],
        };
        if (data.image) updates.og_image = data.image;
        if (data.favicon) updates.favicon = data.favicon;
        if (data.title) updates.title = data.title;
        if (data.description) updates.description = data.description;
        if (data.image && (!selected_card.height || selected_card.height <= 220)) {
          updates.height = 320;
        }
        updateCard(selected_card.id, updates, true);
        showToast('Updated link title, metadata & preview');
      }
    } catch {
      showToast('Could not fetch link metadata');
    } finally {
      set_is_property_fetching_link(false);
    }
  };

  // URL & Location Handlers
  const handle_paste_card_url = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const trimmed = text.trim();
          updateCard(selected_card.id, { url: trimmed });
          if (selected_card.type === 'geo') {
            handle_apply_geo_url(trimmed);
          }
          showToast('Pasted URL');
        }
      }
    } catch (e) {
      showToast('Please paste the URL directly into the field');
    }
  };

  // Property Panel File Upload Handlers (for File Cards, up to 88MB)
  const handle_property_upload_file = async (file) => {
    if (!file || !selected_card) return;
    if (file.size > MAX_BOARD_FILE_SIZE_BYTES) {
      const size_mb_str = (file.size / (1024 * 1024)).toFixed(1);
      showToast(`File "${file.name}" (${size_mb_str} MB) exceeds the ${MAX_BOARD_FILE_SIZE_MB} MB upload limit`);
      return;
    }
    set_is_property_uploading(true);
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
        cardId: selected_card.id,
        mimeType: mime_type,
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
      };

      if ((is_new_file_3d || is_new_file_pdf) && (!selected_card.height || selected_card.height < 380)) {
        update_payload.height = 440;
        update_payload.width = Math.max(selected_card.width || 340, 360);
      }

      updateCard(selected_card.id, update_payload, true);
      saveCurrentBoardToStore();
      showToast(`Uploaded ${file.name} successfully`);
    } catch (upload_err) {
      console.error('File upload error:', upload_err);
      showToast(upload_err.message || 'Failed to attach file');
    } finally {
      set_is_property_uploading(false);
    }
  };

  const handle_property_remove_file = () => {
    if (!selected_card) return;
    updateCard(
      selected_card.id,
      {
        file_name: '',
        title: 'File Attachment',
        file_size: 0,
        file_data: null,
        file_url: null,
        view_url: null,
        file_id: null,
        file_storage_code: null,
        file_extension: '',
        uploaded_at: null,
      },
      true
    );
    saveCurrentBoardToStore();
    showToast('File removed');
  };

  const handle_property_download_file = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (!selected_card) return;
    const file_name = selected_card.file_name || selected_card.title || 'Attached_File';
    const file_url =
      selected_card.file_url ||
      (selected_card.file_id ? `/api/files/download/${selected_card.file_id}` : null);

    if (!file_url && !selected_card.file_data) {
      showToast('Upload a file first to download');
      return;
    }

    const next_count = (selected_card.download_count || 0) + 1;
    updateCard(selected_card.id, { download_count: next_count }, false);
    saveCurrentBoardToStore();

    showToast(`Downloading ${file_name}...`);

    const link = document.createElement('a');
    link.href = file_url || selected_card.file_data;
    link.download = file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handle_attach_place_to_card = (place) => {
    if (!place || !selected_card) return;
    const gmap_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((place.name || '') + ' ' + (place.address || ''))}`;
    updateCard(selected_card.id, {
      location_name: place.name,
      address: place.address || place.display_name || '',
      latitude: place.latitude,
      longitude: place.longitude,
      location_url: gmap_url,
      url: selected_card.url || gmap_url,
    });
    set_geo_search_results([]);
    set_geo_search_query('');
    showToast(`Attached location "${place.name}" to card`);
  };

  const handle_remove_place_from_card = () => {
    if (!selected_card) return;
    updateCard(selected_card.id, {
      location_name: null,
      address: null,
      latitude: null,
      longitude: null,
      location_url: null,
    });
    showToast('Removed location from card');
  };

  const handle_convert_card_to_geo = () => {
    if (!selected_card) return;
    const gmap_url = selected_card.location_url || selected_card.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected_card.location_name || selected_card.title || '')}`;
    const lat = typeof selected_card.latitude === 'number' ? selected_card.latitude : 34.9949;
    const lng = typeof selected_card.longitude === 'number' ? selected_card.longitude : 135.7850;
    updateCard(selected_card.id, {
      type: 'geo',
      url: gmap_url,
      latitude: lat,
      longitude: lng,
      zoom: 15,
      destinations: [
        {
          id: `dest_${Date.now()}`,
          name: selected_card.location_name || selected_card.title || 'Location Pin',
          address: selected_card.address || '',
          latitude: lat,
          longitude: lng,
        },
      ],
    });
    showToast(`Converted "${selected_card.title || 'Card'}" to Map Card`);
  };

  const handle_select_geo_place = (place, add_as_stop = false) => {
    if (!place) return;
    const gmap_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((place.name || '') + ' ' + (place.address || ''))}`;

    if (add_as_stop) {
      const existing_destinations = Array.isArray(selected_card.destinations) ? selected_card.destinations : [];
      const new_dest = {
        id: `dest_search_${Date.now()}`,
        name: place.name || 'New Stop',
        address: place.address || place.display_name || '',
        latitude: place.latitude,
        longitude: place.longitude,
      };
      const updated_destinations = [...existing_destinations, new_dest];
      updateCard(selected_card.id, {
        destinations: updated_destinations,
        url: gmap_url,
      });
      showToast(`Added stop: "${new_dest.name}" to route`);
    } else {
      const new_dest = {
        id: `dest_main_${Date.now()}`,
        name: place.name || 'Location',
        address: place.address || place.display_name || '',
        latitude: place.latitude,
        longitude: place.longitude,
      };
      const should_update_title =
        !selected_card.title ||
        selected_card.title === 'Kyoto Design Pavilion' ||
        selected_card.title === selected_card.location_name ||
        selected_card.title === 'Location Pin';

      updateCard(selected_card.id, {
        location_name: place.name,
        address: place.address || place.display_name || '',
        latitude: place.latitude,
        longitude: place.longitude,
        title: should_update_title ? place.name : selected_card.title,
        url: gmap_url,
        destinations: [new_dest],
      });
      set_geo_url_input(gmap_url);
      showToast(`Location set to "${place.name}"`);
    }

    set_geo_search_results([]);
    set_geo_search_query('');
  };

  const handle_apply_geo_url = async (custom_url) => {
    const raw_url = (custom_url !== undefined ? custom_url : (geo_url_input || selected_card.url || '')).trim();
    if (!raw_url) return;

    set_is_resolving_geo_url(true);
    try {
      const parsed = await resolve_and_parse_gmap_url(raw_url);
      if (parsed) {
        if (parsed.is_directions && Array.isArray(parsed.destinations) && parsed.destinations.length > 0) {
          updateCard(selected_card.id, {
            url: raw_url,
            destinations: parsed.destinations,
            travel_mode: parsed.travel_mode || selected_card.travel_mode || 'driving',
            latitude: parsed.destinations[0]?.latitude ?? selected_card.latitude,
            longitude: parsed.destinations[0]?.longitude ?? selected_card.longitude,
            location_name: parsed.location_name || `Route (${parsed.destinations.length} Stops)`,
            title: parsed.location_name || selected_card.title,
            address: `${parsed.destinations.length} stops route`,
          });
          showToast(`Imported ${parsed.destinations.length} Google Maps destinations!`);
        } else {
          const new_dest = {
            id: `dest_url_${Date.now()}`,
            name: parsed.location_name || selected_card.location_name || 'Location Pin',
            address: parsed.address || selected_card.address || '',
            latitude: parsed.latitude ?? selected_card.latitude,
            longitude: parsed.longitude ?? selected_card.longitude,
          };
          updateCard(selected_card.id, {
            url: raw_url,
            location_name: parsed.location_name || selected_card.location_name,
            address: parsed.address || selected_card.address,
            latitude: parsed.latitude ?? selected_card.latitude,
            longitude: parsed.longitude ?? selected_card.longitude,
            zoom: parsed.zoom || selected_card.zoom || 15,
            destinations: [new_dest],
          });
          showToast(`Location updated: ${parsed.location_name || 'Coordinates set'}`);
        }
      } else {
        updateCard(selected_card.id, { url: raw_url });
        showToast('Updated location link URL');
      }
    } catch (err) {
      updateCard(selected_card.id, { url: raw_url });
      showToast('Updated location URL');
    } finally {
      set_is_resolving_geo_url(false);
    }
  };

  const handle_paste_geo_url = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          set_geo_url_input(text.trim());
          handle_apply_geo_url(text.trim());
        }
      }
    } catch (e) {
      showToast('Please paste the URL directly into the field');
    }
  };

  const handle_remove_destination_stop = (dest_idx) => {
    const list = Array.isArray(selected_card.destinations) ? selected_card.destinations : [];
    if (list.length <= 1) {
      showToast('At least one location stop is required');
      return;
    }
    const filtered = list.filter((_, idx) => idx !== dest_idx);
    updateCard(selected_card.id, {
      destinations: filtered,
      latitude: filtered[0]?.latitude ?? selected_card.latitude,
      longitude: filtered[0]?.longitude ?? selected_card.longitude,
      location_name: filtered.length > 1 ? `Route: ${filtered[0].name} → ${filtered[filtered.length - 1].name}` : filtered[0].name,
    });
    showToast(`Removed stop (${filtered.length} remaining)`);
  };

  const handle_color_change = (color_name) => {
    updateCard(selected_card.id, { color: color_name });
  };

  const handle_custom_bg_change = (e) => {
    updateCard(selected_card.id, { bg_color: e.target.value });
  };

  const handle_custom_text_color_change = (e) => {
    updateCard(selected_card.id, { text_color: e.target.value });
  };

  const handle_width_change = (e) => {
    const raw = e.target.value;
    set_width_input(raw);
    if (!selected_card) return;
    if (raw === '') return;
    const val = parseInt(raw, 10);
    if (!isNaN(val)) {
      updateCard(selected_card.id, { width: val });
    }
  };

  const handle_width_blur = () => {
    if (!selected_card) return;
    if (width_input === '' || isNaN(parseInt(width_input, 10))) {
      const fallback = selected_card.width ?? 360;
      set_width_input(String(fallback));
      updateCard(selected_card.id, { width: fallback });
    } else {
      const val = parseInt(width_input, 10);
      set_width_input(String(val));
      updateCard(selected_card.id, { width: val });
    }
  };

  const handle_height_change = (e) => {
    const raw = e.target.value;
    set_height_input(raw);
    if (!selected_card) return;
    if (raw === '') return;
    const val = parseInt(raw, 10);
    if (!isNaN(val)) {
      updateCard(selected_card.id, { height: val });
    }
  };

  const handle_height_blur = () => {
    if (!selected_card) return;
    if (height_input === '' || isNaN(parseInt(height_input, 10))) {
      const fallback = selected_card.height ?? 216;
      set_height_input(String(fallback));
      updateCard(selected_card.id, { height: fallback });
    } else {
      const val = parseInt(height_input, 10);
      set_height_input(String(val));
      updateCard(selected_card.id, { height: val });
    }
  };

  const handle_x_change = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      updateCard(selected_card.id, { x: val });
    }
  };

  const handle_y_change = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      updateCard(selected_card.id, { y: val });
    }
  };

  const handle_z_index_change = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      updateCard(selected_card.id, { zIndex: val });
    }
  };

  const handle_toggle_locked = () => {
    const next_val = !selected_card.locked;
    updateCard(selected_card.id, { locked: next_val });
    showToast(next_val ? 'Card locked' : 'Card unlocked');
  };

  const handle_toggle_hidden = () => {
    const next_val = !selected_card.hidden;
    updateCard(selected_card.id, { hidden: next_val });
    showToast(next_val ? 'Card hidden' : 'Card visible');
  };

  // Stock Card Handlers
  const handle_stock_symbol_change = (sym) => {
    const normalized = sym.trim().toUpperCase();
    updateCard(selected_card.id, { symbol: normalized });
    showToast(`Stock symbol updated to ${normalized}`);
  };

  const handle_stock_range_change = (rng) => {
    updateCard(selected_card.id, { range: rng });
  };

  // Carousel Slides Handlers
  const slides = normalize_card_slides(selected_card);
  const active_slide_idx = Math.max(
    0,
    Math.min(selected_card.active_slide_index ?? 0, Math.max(0, slides.length - 1))
  );

  const process_carousel_files = (files) => {
    if (!files || files.length === 0) return;

    const valid_files = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (valid_files.length === 0) {
      showToast('Please select valid image files (PNG, JPG, WebP, etc.)');
      return;
    }

    const read_promises = valid_files.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(read_promises).then((data_urls) => {
      const successful = data_urls.filter(Boolean);
      if (successful.length > 0) {
        const current_slides = normalize_card_slides(selected_card);
        const new_items = successful.map((url, idx) => ({
          id: `slide_${Date.now()}_${idx}`,
          url,
          caption: '',
        }));
        const combined = [...current_slides, ...new_items];
        const next_index = combined.length - 1;
        updateCard(selected_card.id, {
          images: combined,
          imageUrl: combined[next_index]?.url,
          caption: combined[next_index]?.caption || '',
          active_slide_index: next_index,
        });
        showToast(`Uploaded ${successful.length} slide${successful.length > 1 ? 's' : ''}`);
      }
    });
  };

  const handle_file_upload_change = (e) => {
    process_carousel_files(e.target.files);
    e.target.value = '';
  };

  const handle_carousel_drag_over = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!is_carousel_drag_over) {
      set_is_carousel_drag_over(true);
    }
  };

  const handle_carousel_drag_leave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.relatedTarget instanceof Node && e.currentTarget?.contains(e.relatedTarget)) {
      return;
    }
    set_is_carousel_drag_over(false);
  };

  const handle_carousel_drop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    set_is_carousel_drag_over(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      process_carousel_files(files);
      return;
    }

    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (uri && (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:image/'))) {
      const current_slides = normalize_card_slides(selected_card);
      const new_slide = {
        id: `slide_${Date.now()}`,
        url: uri.trim(),
        caption: '',
      };
      const combined = [...current_slides, new_slide];
      const next_index = combined.length - 1;
      updateCard(selected_card.id, {
        images: combined,
        imageUrl: combined[next_index]?.url,
        caption: combined[next_index]?.caption || '',
        active_slide_index: next_index,
      });
      showToast('Slide added to carousel');
    }
  };

  const handle_add_slide_url = () => {
    if (!new_slide_url.trim()) return;
    const current_slides = normalize_card_slides(selected_card);
    const new_slide = {
      id: `slide_${Date.now()}`,
      url: new_slide_url.trim(),
      caption: '',
    };
    const combined = [...current_slides, new_slide];
    const next_index = combined.length - 1;
    updateCard(selected_card.id, {
      images: combined,
      imageUrl: combined[next_index]?.url,
      caption: combined[next_index]?.caption || '',
      active_slide_index: next_index,
    });
    set_new_slide_url('');
    showToast('Slide added to carousel');
  };

  const handle_delete_slide = (slide_idx) => {
    const current_slides = normalize_card_slides(selected_card);
    if (current_slides.length <= 1) {
      showToast('Carousel needs at least one slide');
      return;
    }
    const filtered = current_slides.filter((_, idx) => idx !== slide_idx);
    const next_active = Math.max(0, Math.min(active_slide_idx, filtered.length - 1));
    updateCard(selected_card.id, {
      images: filtered,
      imageUrl: filtered[next_active]?.url,
      caption: filtered[next_active]?.caption || '',
      active_slide_index: next_active,
    });
    showToast('Slide removed');
  };

  const handle_set_active_slide = (slide_idx) => {
    const current_slides = normalize_card_slides(selected_card);
    const target = current_slides[slide_idx];
    if (target) {
      updateCard(selected_card.id, {
        active_slide_index: slide_idx,
        imageUrl: target.url,
        caption: target.caption || '',
      });
      showToast(`Viewing slide #${slide_idx + 1}`);
    }
  };

  const handle_update_slide_caption = (slide_idx, caption_val) => {
    const current_slides = normalize_card_slides(selected_card);
    const updated = current_slides.map((s, idx) =>
      idx === slide_idx ? { ...s, caption: caption_val } : s
    );
    updateCard(selected_card.id, {
      images: updated,
      caption: active_slide_idx === slide_idx ? caption_val : selected_card.caption,
    });
  };

  const handle_move_slide = (from_idx, to_idx) => {
    const current_slides = normalize_card_slides(selected_card);
    if (to_idx < 0 || to_idx >= current_slides.length) return;
    const reordered = [...current_slides];
    const [moved] = reordered.splice(from_idx, 1);
    reordered.splice(to_idx, 0, moved);
    updateCard(selected_card.id, {
      images: reordered,
      active_slide_index: to_idx,
      imageUrl: reordered[to_idx]?.url,
      caption: reordered[to_idx]?.caption || '',
    });
  };

  // Download a single slide image from Card Properties
  const download_property_slide = async (slide_obj, slide_idx = 0) => {
    if (!slide_obj || !slide_obj.url) return;
    const raw_url = String(slide_obj.url).trim();
    const raw_label = String(
      slide_obj.caption || selected_card.title || selected_card.caption || 'lumen_image'
    ).trim();
    const clean_base =
      raw_label
        .replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48) || 'lumen_image';

    let ext = String(slide_obj.output_format || selected_card.output_format || '').toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
      const data_match = raw_url.match(/^data:image\/([a-zA-Z0-9+.-]+);/i);
      const url_ext_match = raw_url.split('?')[0].match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
      if (data_match && data_match[1]) {
        ext = data_match[1].toLowerCase() === 'jpeg' ? 'jpg' : data_match[1].toLowerCase();
      } else if (url_ext_match && url_ext_match[1]) {
        ext = url_ext_match[1].toLowerCase() === 'jpeg' ? 'jpg' : url_ext_match[1].toLowerCase();
      } else {
        ext = 'jpg';
      }
    }

    const slide_suffix = slides.length > 1 ? `_slide_${slide_idx + 1}` : '';
    const file_name = `${clean_base}${slide_suffix}.${ext}`;

    const trigger_anchor_download = (href_url) => {
      const link = document.createElement('a');
      link.href = href_url;
      link.download = file_name;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (raw_url.startsWith('data:image/')) {
      trigger_anchor_download(raw_url);
      return;
    }

    const file_id_match = raw_url.match(/\/api\/files\/(?:view|download)\/([^/?#]+)/i);
    const resolved_file_id = slide_obj.file_id || (file_id_match ? file_id_match[1] : null);
    const fetch_target_url = resolved_file_id
      ? `/api/files/download/${resolved_file_id}`
      : raw_url;

    try {
      const resp = await fetch(fetch_target_url);
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob && blob.size > 0) {
          const blob_url = URL.createObjectURL(blob);
          trigger_anchor_download(blob_url);
          setTimeout(() => URL.revokeObjectURL(blob_url), 10000);
          return;
        }
      }
    } catch (_err) {
      // Fallback to direct anchor download if external CORS restricts fetch
    }

    trigger_anchor_download(fetch_target_url);
  };

  const handle_property_download_current_slide = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const target_slide = slides[active_slide_idx] || slides[0];
    if (!target_slide || !target_slide.url) {
      showToast('No image to download');
      return;
    }
    showToast(
      slides.length > 1
        ? `Downloading slide ${active_slide_idx + 1} of ${slides.length}...`
        : 'Downloading image...'
    );
    await download_property_slide(target_slide, active_slide_idx);
  };

  const handle_property_download_all_slides = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (slides.length === 0) return;
    showToast(`Downloading all ${slides.length} images...`);
    for (let i = 0; i < slides.length; i += 1) {
      await download_property_slide(slides[i], i);
      if (i < slides.length - 1) {
        await new Promise((r) => setTimeout(r, 220));
      }
    }
  };

  // Tags Handlers
  const handle_add_tag = () => {
    if (!new_tag_text.trim()) return;
    const existing = selected_card.tags || [];
    const updated = [...existing, { text: new_tag_text.trim(), color: new_tag_color }];
    updateCard(selected_card.id, { tags: updated });
    set_new_tag_text('');
    showToast(`Added label "${new_tag_text.trim()}"`);
  };

  const handle_remove_tag = (tag_index) => {
    const existing = selected_card.tags || [];
    const updated = existing.filter((_, idx) => idx !== tag_index);
    updateCard(selected_card.id, { tags: updated });
  };

  // Tasklist Handlers
  const handle_add_task_item = () => {
    if (!new_task_text.trim()) return;
    const items = selected_card.items || [];
    const new_item = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      text: new_task_text.trim(),
      done: false,
    };
    updateCard(selected_card.id, { items: [...items, new_item] });
    set_new_task_text('');
  };

  const handle_toggle_task_item = (task_id) => {
    const items = selected_card.items || [];
    const updated = items.map((t) => (t.id === task_id ? { ...t, done: !t.done } : t));
    updateCard(selected_card.id, { items: updated });
  };

  const handle_update_task_text = (task_id, text) => {
    const items = selected_card.items || [];
    const updated = items.map((t) => (t.id === task_id ? { ...t, text } : t));
    updateCard(selected_card.id, { items: updated });
  };

  const handle_delete_task_item = (task_id) => {
    const items = selected_card.items || [];
    const updated = items.filter((t) => t.id !== task_id);
    updateCard(selected_card.id, { items: updated });
  };

  // Task completion calculation
  const task_items = selected_card.items || [];
  const completed_tasks = task_items.filter((t) => t.done).length;
  const task_progress_pct =
    task_items.length > 0 ? Math.round((completed_tasks / task_items.length) * 100) : 0;

  // Palette Handlers
  const palette_colors = selected_card.colors || [];
  const handle_add_palette_color = () => {
    const new_color = {
      id: `c_${Date.now()}`,
      hex: '#3b82f6',
      name: 'New Color',
      role: 'Accent',
    };
    updateCard(selected_card.id, { colors: [...palette_colors, new_color] });
  };

  const handle_update_palette_color = (color_idx, updates) => {
    const updated = palette_colors.map((c, idx) => (idx === color_idx ? { ...c, ...updates } : c));
    updateCard(selected_card.id, { colors: updated });
  };

  const handle_delete_palette_color = (color_idx) => {
    const updated = palette_colors.filter((_, idx) => idx !== color_idx);
    updateCard(selected_card.id, { colors: updated });
  };

  const handle_apply_curated_palette = (preset) => {
    updateCard(selected_card.id, {
      title: preset.name,
      description: preset.description || '',
      colors: preset.colors,
    });
    showToast(`Applied "${preset.name}" palette`);
  };

  return (
    <aside
      className={styles['lumen-property-panel'] || styles.lumenPropertyPanel}
      aria-label="Full Card Properties Inspector"
      onWheel={(e) => e.stopPropagation()}
      data-lumen-menu="true"
    >
      {/* Header */}
      <div className={styles['lumen-property-header'] || styles.lumenPropertyHeader}>
        <div className={styles['lumen-property-title-wrap'] || styles.lumenPropertyTitleWrap}>
          <div className={styles['lumen-property-title'] || styles.lumenPropertyTitle}>
            <Sliders size={14} />
            <span>Card Properties</span>
          </div>
          <span className={styles['lumen-property-type-tag'] || styles.lumenPropertyTypeTag}>
            {selected_card.type === 'geo' || selected_card.type === 'location' ? 'Location' : (selected_card.type || 'Card')}
          </span>
        </div>

        <div className={styles['lumen-property-header-actions'] || styles.lumenPropertyHeaderActions}>
          {/* Auto-Open Switch Button for Wide Screen */}
          <button
            type="button"
            className={`${styles['lumen-property-auto-toggle'] || styles.lumenPropertyAutoToggle} ${
              isAutoOpenPropertyEnabledSignal.value
                ? (styles['lumen-property-auto-toggle-active'] || styles.lumenPropertyAutoToggleActive)
                : ''
            }`}
            onClick={() => {
              const next_val = toggleAutoOpenProperty();
              showToast(
                next_val
                  ? 'Auto-open card properties enabled'
                  : 'Auto-open card properties disabled'
              );
            }}
            title={
              isAutoOpenPropertyEnabledSignal.value
                ? 'Auto-open on selection is ON. Click to turn OFF.'
                : 'Auto-open on selection is OFF. Click to turn ON.'
            }
          >
            <span>Auto: {isAutoOpenPropertyEnabledSignal.value ? 'ON' : 'OFF'}</span>
          </button>
          <button
            type="button"
            className={styles['lumen-property-close-btn'] || styles.lumenPropertyCloseBtn}
            onClick={closePropertyPanel}
            title="Close Properties"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className={styles['lumen-property-tabs'] || styles.lumenPropertyTabs}>
        <button
          type="button"
          className={`${styles['lumen-property-tab'] || styles.lumenPropertyTab} ${
            active_tab === 'content'
              ? (styles['lumen-property-tab-active'] || styles.lumenPropertyTabActive)
              : ''
          }`}
          onClick={() => set_active_tab('content')}
        >
          Content
        </button>
        <button
          type="button"
          className={`${styles['lumen-property-tab'] || styles.lumenPropertyTab} ${
            active_tab === 'encryption'
              ? (styles['lumen-property-tab-active'] || styles.lumenPropertyTabActive)
              : ''
          }`}
          onClick={() => set_active_tab('encryption')}
        >
          Encryption
        </button>
        <button
          type="button"
          className={`${styles['lumen-property-tab'] || styles.lumenPropertyTab} ${
            active_tab === 'style'
              ? (styles['lumen-property-tab-active'] || styles.lumenPropertyTabActive)
              : ''
          }`}
          onClick={() => set_active_tab('style')}
        >
          Style
        </button>
        <button
          type="button"
          className={`${styles['lumen-property-tab'] || styles.lumenPropertyTab} ${
            active_tab === 'layout'
              ? (styles['lumen-property-tab-active'] || styles.lumenPropertyTabActive)
              : ''
          }`}
          onClick={() => set_active_tab('layout')}
        >
          Layout
        </button>
        <button
          type="button"
          className={`${styles['lumen-property-tab'] || styles.lumenPropertyTab} ${
            active_tab === 'tags'
              ? (styles['lumen-property-tab-active'] || styles.lumenPropertyTabActive)
              : ''
          }`}
          onClick={() => set_active_tab('tags')}
        >
          Labels & Info
        </button>
        <button
          type="button"
          className={`${styles['lumen-property-tab'] || styles.lumenPropertyTab} ${
            active_tab === 'ai'
              ? (styles['lumen-property-tab-active'] || styles.lumenPropertyTabActive)
              : ''
          }`}
          onClick={() => set_active_tab('ai')}
        >
          AI
        </button>
      </div>

      {/* Tab 1: Content & Specific Attributes */}
      {active_tab === 'content' && (
        <div className={styles['lumen-property-body'] || styles.lumenPropertyBody}>
          {/* Card Title */}
          <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
            <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
              <span>Card Title</span>
            </label>
            <input
              type="text"
              value={selected_card.title || ''}
              onChange={handle_title_change}
              className={styles['lumen-property-input'] || styles.lumenPropertyInput}
              placeholder="Enter card title..."
            />
          </div>

          {/* Card Style (Board Default vs Per-Card Override) */}
          <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
            <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
              <span>Card Style</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 6 }}>
              {[
                {
                  id: 'board_default',
                  label: `Board (${(active_board?.board_setting?.card_style || 'full') === 'seamless' ? 'Seamless' : 'Full'})`,
                  hint: 'Inherit the default card style from Board Settings',
                },
                {
                  id: 'full',
                  label: 'Full',
                  hint: 'Override board setting: always display full card chrome & buttons',
                },
                {
                  id: 'seamless',
                  label: 'Seamless',
                  hint: 'Override board setting: show only card content with minimal border',
                },
              ].map((opt) => {
                const current_mode =
                  selected_card.card_style === 'full' || selected_card.card_style === 'seamless'
                    ? selected_card.card_style
                    : 'board_default';
                const is_active = current_mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      const next_style = opt.id === 'board_default' ? null : opt.id;
                      updateCard(selected_card.id, { card_style: next_style });
                      saveCurrentBoardToStore();
                      showToast(
                        opt.id === 'board_default'
                          ? 'Card style set to follow Board Default'
                          : `Card style overridden to ${opt.label}`
                      );
                    }}
                    title={opt.hint}
                    style={{
                      padding: '6px 8px',
                      fontSize: 11,
                      fontWeight: is_active ? 600 : 500,
                      borderRadius: 6,
                      border: is_active
                        ? '1px solid var(--lumen-accent, #2563eb)'
                        : '1px solid var(--lumen-border, #e2e8f0)',
                      backgroundColor: is_active
                        ? 'rgba(37, 99, 235, 0.08)'
                        : 'var(--lumen-surface, #ffffff)',
                      color: is_active
                        ? 'var(--lumen-accent, #2563eb)'
                        : 'var(--lumen-text-secondary, #475569)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* UNIVERSAL CARD TIME RANGE & GOOGLE CALENDAR SYNC (All Cards) */}
          <LUMEN_card_time_range_section selected_card={selected_card} />

          {/* SOUND RECORDER CARD: Cloud Storage & Transcript Text */}
          {selected_card.type === 'sound_recorder' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Mic size={14} color="var(--lumen-accent, #2563eb)" />
                  <span style={{ fontWeight: 600 }}>Sound Recorder & Cloud Storage</span>
                </div>
              </div>

              {selected_card.file_name && (
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Cloud Audio File</span>
                    <span>{selected_card.audio_duration ? `${selected_card.audio_duration}s` : ''}</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11.5 }}>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selected_card.file_name}
                    </span>
                    <button
                      type="button"
                      className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                      onClick={handle_property_download_file}
                      style={{ padding: '4px 8px', fontSize: 11 }}
                    >
                      <Download size={12} />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              )}

              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Transcript {selected_card.detected_language ? `(${selected_card.detected_language})` : ''}</span>
                </label>
                <textarea
                  rows={3}
                  value={selected_card.transcript || ''}
                  onChange={(e) =>
                    updateCard(selected_card.id, { transcript: e.target.value, content: e.target.value }, false)
                  }
                  placeholder="Audio transcription..."
                  className={styles['lumen-property-textarea'] || styles.lumenPropertyTextarea}
                />
              </div>

              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Translation ({selected_card.target_language || 'English'})</span>
                </label>
                <textarea
                  rows={3}
                  value={selected_card.translated_text || ''}
                  onChange={(e) =>
                    updateCard(selected_card.id, { translated_text: e.target.value }, false)
                  }
                  placeholder="Translated text..."
                  className={styles['lumen-property-textarea'] || styles.lumenPropertyTextarea}
                />
              </div>
            </div>
          )}

          {/* LOCATION CARD: Place Search & Map Coordinates (Available prominently for Location Card) */}
          {(selected_card.type === 'geo' || selected_card.type === 'location') && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} color="var(--lumen-accent, #2563eb)" />
                  <span style={{ fontWeight: 600 }}>Place Search & Map Coordinates</span>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--lumen-accent, #2563eb)',
                    backgroundColor: '#eff6ff',
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: '1px solid #bfdbfe',
                  }}
                >
                  Location Card
                </span>
              </div>

              {/* 1. Feature: Search Places & Landmarks with Instant Autocomplete */}
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Search size={12} color="var(--lumen-accent, #2563eb)" />
                    <span>Search Places & Landmarks (Live Autocomplete)</span>
                  </div>
                  {is_searching_places && (
                    <span style={{ fontSize: 10, color: 'var(--lumen-accent, #2563eb)' }}>Searching...</span>
                  )}
                </label>

                <div className={styles['lumen-property-geo-search-wrap'] || styles.lumenPropertyGeoSearchWrap}>
                  <div className={styles['lumen-property-geo-search-input-box'] || styles.lumenPropertyGeoSearchInputBox}>
                    <Search size={13} color="var(--lumen-text-muted, #94a3b8)" />
                    <input
                      type="text"
                      value={geo_search_query}
                      onChange={(e) => handle_search_places_query(e.target.value)}
                      onFocus={() => set_is_geo_search_open(true)}
                      placeholder="Type place name, landmark or city (e.g. Kyoto Tower, Eiffel Tower)..."
                      className={styles['lumen-property-geo-search-input'] || styles.lumenPropertyGeoSearchInput}
                    />
                    {is_searching_places && (
                      <span className={styles['lumen-property-geo-spinner'] || styles.lumenPropertyGeoSpinner} title="Searching..." />
                    )}
                    {geo_search_query && (
                      <button
                        type="button"
                        onClick={() => {
                          set_geo_search_query('');
                          set_geo_search_results([]);
                          set_is_geo_search_open(false);
                        }}
                        className={styles['lumen-property-geo-search-clear'] || styles.lumenPropertyGeoSearchClear}
                        title="Clear search"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Search Results Dropdown - Stays open and never vanishes while typing */}
                  {is_geo_search_open && (geo_search_query.trim().length > 0 || geo_search_results.length > 0) && (
                    <div
                      className={styles['lumen-property-geo-search-results'] || styles.lumenPropertyGeoSearchResults}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {geo_search_results.length > 0 ? (
                        geo_search_results.map((place, p_idx) => (
                          <div
                            key={place.place_id || `${place.name}_${p_idx}`}
                            className={styles['lumen-property-geo-result-item'] || styles.lumenPropertyGeoResultItem}
                          >
                            <div className={styles['lumen-property-geo-result-header'] || styles.lumenPropertyGeoResultHeader}>
                              <span className={styles['lumen-property-geo-result-name'] || styles.lumenPropertyGeoResultName}>
                                {place.name}
                              </span>
                              <span className={styles['lumen-property-geo-result-type'] || styles.lumenPropertyGeoResultType}>
                                {place.type || 'place'}
                              </span>
                            </div>
                            <span className={styles['lumen-property-geo-result-addr'] || styles.lumenPropertyGeoResultAddr}>
                              {place.address || place.display_name}
                            </span>
                            <span className={styles['lumen-property-geo-result-coords'] || styles.lumenPropertyGeoResultCoords}>
                              {typeof place.latitude === 'number' ? place.latitude.toFixed(4) : ''}°, {typeof place.longitude === 'number' ? place.longitude.toFixed(4) : ''}°
                            </span>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              <button
                                type="button"
                                className={`${styles['lumen-property-geo-action-btn'] || styles.lumenPropertyGeoActionBtn} ${styles['lumen-property-geo-action-primary'] || styles.lumenPropertyGeoActionPrimary}`}
                                style={{ flex: 1, padding: '3px 8px', fontSize: 10.5 }}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handle_select_geo_place(place, false)}
                              >
                                <MapPin size={10} />
                                <span>Set Location</span>
                              </button>
                              <button
                                type="button"
                                className={styles['lumen-property-geo-action-btn'] || styles.lumenPropertyGeoActionBtn}
                                style={{ padding: '3px 8px', fontSize: 10.5 }}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handle_select_geo_place(place, true)}
                                title="Add this place as a stop in the multi-destination route"
                              >
                                <Route size={10} />
                                <span>+ Add Stop</span>
                              </button>
                            </div>
                          </div>
                        ))
                      ) : is_searching_places ? (
                        <div className={styles['lumen-property-geo-search-loading'] || styles.lumenPropertyGeoSearchLoading}>
                          <span className={styles['lumen-property-geo-spinner'] || styles.lumenPropertyGeoSpinner} />
                          <span>Searching live global places for "{geo_search_query}"...</span>
                        </div>
                      ) : (
                        <div className={styles['lumen-property-geo-no-results'] || styles.lumenPropertyGeoNoResults}>
                          <span>No places found for "{geo_search_query}"</span>
                          <button
                            type="button"
                            className={styles['lumen-property-geo-custom-pin-btn'] || styles.lumenPropertyGeoCustomPinBtn}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() =>
                              handle_select_geo_place(
                                {
                                  name: geo_search_query.trim(),
                                  address: geo_search_query.trim(),
                                  latitude: selected_card.latitude || 34.9949,
                                  longitude: selected_card.longitude || 135.7850,
                                },
                                false
                              )
                            }
                          >
                            + Use as Custom Location
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Google Maps / Location URL Input Field */}
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Navigation size={11} color="var(--lumen-accent, #2563eb)" />
                    <span>Google Maps / Location URL</span>
                  </div>
                  {selected_card.url && (
                    <a
                      href={selected_card.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 10.5,
                        color: 'var(--lumen-accent, #2563eb)',
                        textDecoration: 'none',
                      }}
                    >
                      <span>Open Maps</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </label>
                <div className={styles['lumen-property-geo-url-row'] || styles.lumenPropertyGeoUrlRow}>
                  <input
                    type="text"
                    value={geo_url_input !== '' ? geo_url_input : (selected_card.url || '')}
                    onChange={(e) => set_geo_url_input(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handle_apply_geo_url(e.target.value);
                      }
                    }}
                    placeholder="Paste Google Maps URL or coordinates..."
                    className={`${styles['lumen-property-input'] || styles.lumenPropertyInput} ${styles['lumen-property-geo-url-input'] || styles.lumenPropertyGeoUrlInput}`}
                  />
                  <button
                    type="button"
                    onClick={handle_paste_geo_url}
                    className={styles['lumen-property-geo-action-btn'] || styles.lumenPropertyGeoActionBtn}
                    title="Paste Google Maps link from clipboard"
                  >
                    <span>Paste</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handle_apply_geo_url()}
                    disabled={is_resolving_geo_url}
                    className={`${styles['lumen-property-geo-action-btn'] || styles.lumenPropertyGeoActionBtn} ${styles['lumen-property-geo-action-primary'] || styles.lumenPropertyGeoActionPrimary}`}
                    title="Apply URL & parse coordinates"
                  >
                    <span>{is_resolving_geo_url ? 'Loading...' : 'Apply'}</span>
                  </button>
                </div>
              </div>

              {/* 3. Location Name & Address Fields */}
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Location Name</span>
                </label>
                <input
                  type="text"
                  value={selected_card.location_name || ''}
                  onChange={(e) => updateCard(selected_card.id, { location_name: e.target.value })}
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                />
              </div>
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Address</span>
                </label>
                <input
                  type="text"
                  value={selected_card.address || ''}
                  onChange={(e) => updateCard(selected_card.id, { address: e.target.value })}
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                />
              </div>

              {/* 4. Coordinate Numbers */}
              <div className={styles['lumen-property-row'] || styles.lumenPropertyRow}>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Latitude</span>
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={selected_card.latitude !== undefined ? selected_card.latitude : 35.0}
                    onChange={(e) =>
                      updateCard(selected_card.id, { latitude: parseFloat(e.target.value) })
                    }
                    className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                  />
                </div>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Longitude</span>
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={selected_card.longitude !== undefined ? selected_card.longitude : 135.0}
                    onChange={(e) =>
                      updateCard(selected_card.id, { longitude: parseFloat(e.target.value) })
                    }
                    className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                  />
                </div>
              </div>

              {/* 5. Zoom & Travel Mode */}
              <div className={styles['lumen-property-row'] || styles.lumenPropertyRow}>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Zoom Level ({selected_card.zoom || 15})</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={selected_card.zoom || 15}
                    onChange={(e) =>
                      updateCard(selected_card.id, { zoom: parseInt(e.target.value, 10) })
                    }
                  />
                </div>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Travel Mode</span>
                  </label>
                  <select
                    value={selected_card.travel_mode || 'driving'}
                    onChange={(e) => updateCard(selected_card.id, { travel_mode: e.target.value })}
                    className={styles['lumen-property-select'] || styles.lumenPropertySelect}
                  >
                    <option value="driving">Driving</option>
                    <option value="walking">Walking</option>
                    <option value="bicycling">Bicycling</option>
                    <option value="transit">Transit</option>
                  </select>
                </div>
              </div>

              {/* 6. Multi-Stop Route Destinations (if stops exist) */}
              {Array.isArray(selected_card.destinations) && selected_card.destinations.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Route Stops ({selected_card.destinations.length})</span>
                  </label>
                  <div className={styles['lumen-property-geo-stops-container'] || styles.lumenPropertyGeoStopsContainer}>
                    {selected_card.destinations.map((dest, d_idx) => {
                      const letter = String.fromCharCode(65 + d_idx);
                      return (
                        <div
                          key={dest.id || d_idx}
                          className={styles['lumen-property-geo-stop-card'] || styles.lumenPropertyGeoStopCard}
                        >
                          <div className={styles['lumen-property-geo-stop-badge'] || styles.lumenPropertyGeoStopBadge}>
                            {letter}
                          </div>
                          <div className={styles['lumen-property-geo-stop-info'] || styles.lumenPropertyGeoStopInfo}>
                            <span className={styles['lumen-property-geo-stop-name'] || styles.lumenPropertyGeoStopName}>
                              {dest.name}
                            </span>
                            {typeof dest.latitude === 'number' && typeof dest.longitude === 'number' && (
                              <span className={styles['lumen-property-geo-stop-coords'] || styles.lumenPropertyGeoStopCoords}>
                                {dest.latitude.toFixed(4)}°, {dest.longitude.toFixed(4)}°
                              </span>
                            )}
                          </div>
                          {selected_card.destinations.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handle_remove_destination_stop(d_idx)}
                              className={styles['lumen-property-geo-search-clear'] || styles.lumenPropertyGeoSearchClear}
                              title="Remove stop from route"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 7. Field Observations & Notes */}
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField} style={{ marginTop: 8 }}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Location Notes & Observations</span>
                </label>
                <textarea
                  value={selected_card.notes || ''}
                  onChange={(e) => updateCard(selected_card.id, { notes: e.target.value })}
                  className={styles['lumen-property-textarea'] || styles.lumenPropertyTextarea}
                  rows={3}
                  placeholder="Field notes, site visit details, sourcing instructions..."
                />
              </div>
            </div>
          )}

          {/* STOCK CARD: Stock Code / Symbol & Default Range */}
          {selected_card.type === 'stock' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={12} color="var(--lumen-accent)" />
                  Stock Market Configuration
                </span>
                <span style={{ fontSize: 10, color: 'var(--lumen-accent)', fontWeight: 600 }}>
                  {selected_card.symbol || 'MAPI.JK'}
                </span>
              </div>

              {/* Stock Code / Symbol Input */}
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Stock Code / Ticker Symbol</span>
                  <span className={styles['lumen-property-label-hint'] || styles.lumenPropertyLabelHint}>
                    IDX or Global Ticker
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={selected_card.symbol || ''}
                    onChange={(e) => updateCard(selected_card.id, { symbol: e.target.value })}
                    onBlur={(e) => handle_stock_symbol_change(e.target.value || 'MAPI.JK')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handle_stock_symbol_change(e.target.value || 'MAPI.JK');
                      }
                    }}
                    className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                    placeholder="e.g. MAPI.JK, BBCA.JK, AAPL, NVDA"
                    style={{ textTransform: 'uppercase', fontFamily: 'var(--lumen-font-mono, monospace)', fontWeight: 600 }}
                  />
                  <button
                    type="button"
                    className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                    onClick={() => handle_stock_symbol_change(selected_card.symbol || 'MAPI.JK')}
                    title="Apply Stock Code"
                  >
                    Apply
                  </button>
                </div>

                {/* Popular stock symbol presets */}
                <div className={styles['lumen-property-symbol-chips'] || styles.lumenPropertySymbolChips}>
                  {STOCK_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={styles['lumen-property-symbol-chip'] || styles.lumenPropertySymbolChip}
                      onClick={() => handle_stock_symbol_change(preset)}
                      style={{
                        borderColor: selected_card.symbol === preset ? 'var(--lumen-accent)' : undefined,
                        color: selected_card.symbol === preset ? 'var(--lumen-accent)' : undefined,
                        fontWeight: selected_card.symbol === preset ? 700 : undefined,
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Chart Timeframe Range */}
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Default Chart Timeframe</span>
                  <span className={styles['lumen-property-label-hint'] || styles.lumenPropertyLabelHint}>
                    {(selected_card.range || '1d').toUpperCase()}
                  </span>
                </label>
                <div className={styles['lumen-property-range-selector'] || styles.lumenPropertyRangeSelector}>
                  {STOCK_RANGES.map((rng) => (
                    <button
                      key={rng.key}
                      type="button"
                      className={`${styles['lumen-property-range-btn'] || styles.lumenPropertyRangeBtn} ${
                        (selected_card.range || '1d') === rng.key
                          ? (styles['lumen-property-range-btn-active'] || styles.lumenPropertyRangeBtnActive)
                          : ''
                      }`}
                      onClick={() => handle_stock_range_change(rng.key)}
                    >
                      {rng.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency Display & FX Conversion */}
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Display Currency / Konversi Kurs</span>
                  <span className={styles['lumen-property-label-hint'] || styles.lumenPropertyLabelHint}>
                    {selected_card.target_currency ? selected_card.target_currency : 'Original / Asli'}
                  </span>
                </label>
                <select
                  value={selected_card.target_currency || 'ORIGINAL'}
                  onChange={(e) => {
                    const val = e.target.value === 'ORIGINAL' ? undefined : e.target.value;
                    updateCard(selected_card.id, { target_currency: val });
                  }}
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                  style={{ fontWeight: 600 }}
                >
                  <option value="ORIGINAL">Default / Asli (Original Asset Currency)</option>
                  <option value="IDR">IDR — Rupiah Indonesia</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="SGD">SGD — Singapore Dollar</option>
                  <option value="JPY">JPY — Japanese Yen</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="AUD">AUD — Australian Dollar</option>
                  <option value="CNY">CNY — Chinese Yuan</option>
                </select>

                <div className={styles['lumen-property-symbol-chips'] || styles.lumenPropertySymbolChips} style={{ marginTop: 6 }}>
                  {['ORIGINAL', 'IDR', 'USD', 'EUR', 'SGD'].map((c_code) => {
                    const is_active = (!selected_card.target_currency && c_code === 'ORIGINAL') || selected_card.target_currency === c_code;
                    return (
                      <button
                        key={c_code}
                        type="button"
                        className={styles['lumen-property-symbol-chip'] || styles.lumenPropertySymbolChip}
                        onClick={() => updateCard(selected_card.id, { target_currency: c_code === 'ORIGINAL' ? undefined : c_code })}
                        style={{
                          borderColor: is_active ? 'var(--lumen-accent)' : undefined,
                          color: is_active ? 'var(--lumen-accent)' : undefined,
                          fontWeight: is_active ? 700 : undefined,
                        }}
                      >
                        {c_code === 'ORIGINAL' ? 'Asli' : c_code}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* CLOCK CARD: Complete UTC Selector, Date Option, Stopwatch, Countdown & Alarm Mode */}
          {selected_card.type === 'clock' && (() => {
            const prop_clock = normalize_clock_data(selected_card);
            const save_prop_clock = (patch) => {
              const latest = normalize_clock_data(selected_card);
              updateCard(selected_card.id, {
                clock_data: {
                  ...latest,
                  ...patch,
                },
              });
            };
            const cd_h = Math.floor(prop_clock.countdown_duration_sec / 3600);
            const cd_m = Math.floor((prop_clock.countdown_duration_sec % 3600) / 60);
            const cd_s = prop_clock.countdown_duration_sec % 60;
            const update_prop_cd_hms = (nh, nm, ns) => {
              const h = Math.max(0, Math.min(99, Number(nh) || 0));
              const m = Math.max(0, Math.min(59, Number(nm) || 0));
              const s = Math.max(0, Math.min(59, Number(ns) || 0));
              const total_sec = Math.max(1, h * 3600 + m * 60 + s);
              save_prop_clock({
                countdown_duration_sec: total_sec,
                countdown_remaining_ms: total_sec * 1000,
                countdown_running: false,
                countdown_target_ts: null,
              });
            };

            return (
              <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
                <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={12} color="var(--lumen-accent)" />
                    Clock, UTC & Timer Modes
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--lumen-accent)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {prop_clock.mode}
                  </span>
                </div>

                {/* Mode Switcher: Realtime Clock / Stopwatch / Countdown / Alarm */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--lumen-text-secondary, #475569)' }}>
                    Active Card Mode
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                    {[
                      { id: 'clock', label: 'Realtime Clock' },
                      { id: 'stopwatch', label: 'Stopwatch Mode' },
                      { id: 'countdown', label: 'Countdown Mode' },
                      { id: 'alarm', label: 'Alarm Mode' },
                    ].map((m_opt) => {
                      const is_active = prop_clock.mode === m_opt.id;
                      return (
                        <button
                          key={m_opt.id}
                          type="button"
                          onClick={() => save_prop_clock({ mode: m_opt.id })}
                          style={{
                            padding: '7px 10px',
                            borderRadius: 7,
                            border: is_active
                              ? '1.5px solid var(--lumen-accent, #2563eb)'
                              : '1px solid var(--lumen-border, #e2e8f0)',
                            background: is_active
                              ? 'rgba(37, 99, 235, 0.1)'
                              : 'var(--lumen-surface, #ffffff)',
                            color: is_active
                              ? 'var(--lumen-accent, #2563eb)'
                              : 'var(--lumen-text, #1e293b)',
                            fontSize: 11.5,
                            fontWeight: is_active ? 700 : 600,
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          {m_opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Complete UTC Timezone Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--lumen-text-secondary, #475569)' }}>
                      Complete UTC Timezone Selector ({COMPLETE_UTC_OFFSETS.length} Zones)
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--lumen-accent, #2563eb)', fontWeight: 700 }}>
                      {prop_clock.utc_offset}
                    </span>
                  </div>
                  <select
                    className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                    value={prop_clock.utc_offset}
                    onChange={(e) => save_prop_clock({ utc_offset: e.target.value })}
                    style={{ fontSize: 11.5, fontWeight: 600 }}
                  >
                    {COMPLETE_UTC_OFFSETS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <div className={styles['lumen-property-symbol-chips'] || styles.lumenPropertySymbolChips}>
                    {['LOCAL', 'UTC-08:00', 'UTC-05:00', 'UTC+00:00', 'UTC+01:00', 'UTC+07:00', 'UTC+08:00', 'UTC+09:00'].map((tz) => {
                      const is_active = prop_clock.utc_offset === tz;
                      return (
                        <button
                          key={tz}
                          type="button"
                          className={styles['lumen-property-symbol-chip'] || styles.lumenPropertySymbolChip}
                          onClick={() => save_prop_clock({ utc_offset: tz })}
                          style={{
                            borderColor: is_active ? 'var(--lumen-accent)' : undefined,
                            color: is_active ? 'var(--lumen-accent)' : undefined,
                            fontWeight: is_active ? 700 : undefined,
                          }}
                        >
                          {tz}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Clock Display Options (Show Date, 24H, Seconds, Analog Dial, Theme, Chime) */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--lumen-border, #e2e8f0)',
                    backgroundColor: 'var(--lumen-surface-subtle, #f8fafc)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--lumen-text, #1e293b)' }}>
                    Clock Display Options
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                    {[
                      { key: 'show_date', label: 'Show Date', val: prop_clock.show_date },
                      { key: 'use_24h', label: '24-Hour Format', val: prop_clock.use_24h },
                      { key: 'show_seconds', label: 'Show Seconds', val: prop_clock.show_seconds },
                      { key: 'show_analog', label: 'Analog Dial', val: prop_clock.show_analog },
                      { key: 'sound_enabled', label: 'Alarm Chime', val: prop_clock.sound_enabled },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => save_prop_clock({ [opt.key]: !opt.val })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: opt.val
                            ? '1px solid var(--lumen-accent, #2563eb)'
                            : '1px solid var(--lumen-border, #cbd5e1)',
                          background: opt.val ? 'rgba(37, 99, 235, 0.08)' : '#ffffff',
                          color: 'var(--lumen-text, #1e293b)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <span>{opt.label}</span>
                        <span style={{ color: opt.val ? '#2563eb' : '#94a3b8', fontWeight: 700 }}>
                          {opt.val ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        save_prop_clock({ theme: prop_clock.theme === 'light' ? 'dark' : 'light' })
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--lumen-border, #cbd5e1)',
                        background: '#ffffff',
                        color: 'var(--lumen-text, #1e293b)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <span>Face Theme</span>
                      <span style={{ color: '#2563eb', fontWeight: 700, textTransform: 'uppercase' }}>
                        {prop_clock.theme}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Stopwatch Mode Property Controls */}
                {prop_clock.mode === 'stopwatch' && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--lumen-border, #e2e8f0)',
                      backgroundColor: 'var(--lumen-surface-subtle, #f8fafc)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>Stopwatch Controls</span>
                      <span style={{ fontSize: 10.5, color: 'var(--lumen-text-muted)' }}>
                        Laps: {prop_clock.stopwatch_laps.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (prop_clock.stopwatch_running) {
                            const acc = prop_clock.stopwatch_started_at
                              ? prop_clock.stopwatch_elapsed_ms + Math.max(0, Date.now() - prop_clock.stopwatch_started_at)
                              : prop_clock.stopwatch_elapsed_ms;
                            save_prop_clock({
                              stopwatch_running: false,
                              stopwatch_elapsed_ms: acc,
                              stopwatch_started_at: null,
                            });
                          } else {
                            save_prop_clock({
                              stopwatch_running: true,
                              stopwatch_started_at: Date.now(),
                            });
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: 'none',
                          background: 'var(--lumen-accent, #2563eb)',
                          color: '#ffffff',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {prop_clock.stopwatch_running ? 'Pause' : 'Start'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const cur_ms = prop_clock.stopwatch_running && prop_clock.stopwatch_started_at
                            ? prop_clock.stopwatch_elapsed_ms + Math.max(0, Date.now() - prop_clock.stopwatch_started_at)
                            : prop_clock.stopwatch_elapsed_ms;
                          if (!prop_clock.stopwatch_running && cur_ms <= 0) return;
                          const prev_total = prop_clock.stopwatch_laps.length > 0
                            ? Number(prop_clock.stopwatch_laps[0].total_ms || 0)
                            : 0;
                          const split_ms = Math.max(0, cur_ms - prev_total);
                          const next_lap = {
                            id: `lap_${Date.now()}`,
                            lap_number: prop_clock.stopwatch_laps.length + 1,
                            split_ms,
                            total_ms: cur_ms,
                          };
                          save_prop_clock({
                            stopwatch_laps: [next_lap, ...prop_clock.stopwatch_laps].slice(0, 50),
                          });
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--lumen-border, #cbd5e1)',
                          background: '#ffffff',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        + Lap
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          save_prop_clock({
                            stopwatch_running: false,
                            stopwatch_elapsed_ms: 0,
                            stopwatch_started_at: null,
                            stopwatch_laps: [],
                          })
                        }
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--lumen-border, #cbd5e1)',
                          background: '#ffffff',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reset
                      </button>
                    </div>
                    {prop_clock.stopwatch_laps.length > 0 && (
                      <div
                        style={{
                          maxHeight: 120,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                          borderTop: '1px solid var(--lumen-border, #e2e8f0)',
                          paddingTop: 6,
                        }}
                      >
                        {prop_clock.stopwatch_laps.map((lap) => {
                          const s_fmt = format_stopwatch_ms(lap.split_ms);
                          const t_fmt = format_stopwatch_ms(lap.total_ms);
                          return (
                            <div
                              key={lap.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 10.5,
                                fontFamily: 'monospace',
                              }}
                            >
                              <span style={{ color: '#64748b' }}>Lap #{lap.lap_number}</span>
                              <span style={{ color: '#2563eb' }}>+{s_fmt.main}{s_fmt.sub}</span>
                              <span style={{ fontWeight: 700 }}>{t_fmt.main}{t_fmt.sub}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Countdown Mode Property Controls */}
                {prop_clock.mode === 'countdown' && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--lumen-border, #e2e8f0)',
                      backgroundColor: 'var(--lumen-surface-subtle, #f8fafc)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>Countdown Duration (H : M : S)</span>
                      <span style={{ fontSize: 10.5, fontFamily: 'monospace', fontWeight: 700 }}>
                        {format_countdown_ms(prop_clock.countdown_duration_sec * 1000)}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--lumen-text-muted)' }}>Hours</span>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                          value={cd_h}
                          onChange={(e) => update_prop_cd_hms(e.target.value, cd_m, cd_s)}
                        />
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--lumen-text-muted)' }}>Minutes</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                          value={cd_m}
                          onChange={(e) => update_prop_cd_hms(cd_h, e.target.value, cd_s)}
                        />
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--lumen-text-muted)' }}>Seconds</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                          value={cd_s}
                          onChange={(e) => update_prop_cd_hms(cd_h, cd_m, e.target.value)}
                        />
                      </div>
                    </div>
                    <div className={styles['lumen-property-symbol-chips'] || styles.lumenPropertySymbolChips}>
                      {COUNTDOWN_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          className={styles['lumen-property-symbol-chip'] || styles.lumenPropertySymbolChip}
                          onClick={() =>
                            save_prop_clock({
                              countdown_duration_sec: preset.seconds,
                              countdown_remaining_ms: preset.seconds * 1000,
                              countdown_running: false,
                              countdown_target_ts: null,
                            })
                          }
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (prop_clock.countdown_running) {
                            const rem = prop_clock.countdown_target_ts
                              ? Math.max(0, prop_clock.countdown_target_ts - Date.now())
                              : prop_clock.countdown_remaining_ms;
                            save_prop_clock({
                              countdown_running: false,
                              countdown_remaining_ms: rem,
                              countdown_target_ts: null,
                            });
                          } else {
                            const base_ms = prop_clock.countdown_remaining_ms > 0
                              ? prop_clock.countdown_remaining_ms
                              : prop_clock.countdown_duration_sec * 1000;
                            save_prop_clock({
                              countdown_running: true,
                              countdown_remaining_ms: base_ms,
                              countdown_target_ts: Date.now() + base_ms,
                            });
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: 'none',
                          background: 'var(--lumen-accent, #2563eb)',
                          color: '#ffffff',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {prop_clock.countdown_running ? 'Pause Countdown' : 'Start Countdown'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          save_prop_clock({
                            countdown_running: false,
                            countdown_target_ts: null,
                            countdown_remaining_ms: prop_clock.countdown_duration_sec * 1000,
                          })
                        }
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--lumen-border, #cbd5e1)',
                          background: '#ffffff',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}

                {/* Alarm Mode Property Controls */}
                {prop_clock.mode === 'alarm' && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--lumen-border, #e2e8f0)',
                      backgroundColor: 'var(--lumen-surface-subtle, #f8fafc)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>
                        Scheduled Alarms ({prop_clock.alarms.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next_alarm = {
                            id: `alarm_${Date.now()}`,
                            time: '12:00',
                            label: `Alarm #${prop_clock.alarms.length + 1}`,
                            enabled: true,
                          };
                          save_prop_clock({ alarms: [...prop_clock.alarms, next_alarm] });
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 5,
                          border: 'none',
                          background: 'var(--lumen-accent, #2563eb)',
                          color: '#ffffff',
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        + Add Alarm
                      </button>
                    </div>
                    {prop_clock.alarms.map((alarm) => (
                      <div
                        key={alarm.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 6px',
                          borderRadius: 6,
                          background: '#ffffff',
                          border: '1px solid var(--lumen-border, #e2e8f0)',
                        }}
                      >
                        <input
                          type="time"
                          value={alarm.time}
                          onChange={(e) =>
                            save_prop_clock({
                              alarms: prop_clock.alarms.map((a) =>
                                a.id === alarm.id ? { ...a, time: e.target.value } : a
                              ),
                            })
                          }
                          style={{
                            padding: '3px 5px',
                            borderRadius: 5,
                            border: '1px solid #cbd5e1',
                            fontSize: 11,
                            fontFamily: 'monospace',
                            fontWeight: 700,
                          }}
                        />
                        <input
                          type="text"
                          value={alarm.label}
                          onChange={(e) =>
                            save_prop_clock({
                              alarms: prop_clock.alarms.map((a) =>
                                a.id === alarm.id ? { ...a, label: e.target.value } : a
                              ),
                            })
                          }
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '3px 6px',
                            borderRadius: 5,
                            border: '1px solid #cbd5e1',
                            fontSize: 11,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            save_prop_clock({
                              alarms: prop_clock.alarms.map((a) =>
                                a.id === alarm.id ? { ...a, enabled: !a.enabled } : a
                              ),
                            })
                          }
                          style={{
                            padding: '3px 7px',
                            borderRadius: 999,
                            border: 'none',
                            background: alarm.enabled ? '#2563eb' : '#cbd5e1',
                            color: '#ffffff',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {alarm.enabled ? 'ON' : 'OFF'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            save_prop_clock({
                              alarms: prop_clock.alarms.filter((a) => a.id !== alarm.id),
                            })
                          }
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: 2,
                          }}
                          title="Delete alarm"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* IMAGE / CAROUSEL CARD: Slide Upload & Slide Manager */}
          {selected_card.type === 'image' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ImageIcon size={12} color="var(--lumen-accent)" />
                  Image Slides & Carousel ({slides.length})
                </span>
                <span style={{ fontSize: 10, color: 'var(--lumen-accent)', fontWeight: 600 }}>
                  Active #{active_slide_idx + 1}
                </span>
              </div>

              {/* Carousel Autoplay On/Off Switch & Slide Duration */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--lumen-border, #e2e8f0)',
                  backgroundColor: 'var(--lumen-surface-subtle, #f8fafc)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  marginBottom: 4,
                }}
              >
                {/* Row 1: Autoplay On/Off Switch */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {selected_card.autoplay ? (
                      <Play size={13} color="var(--lumen-accent, #2563eb)" />
                    ) : (
                      <Pause size={13} color="var(--lumen-text-muted, #64748b)" />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--lumen-text-primary, #0f172a)' }}>
                        Carousel Autoplay
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--lumen-text-muted, #64748b)' }}>
                        {slides.length > 1
                          ? selected_card.autoplay
                            ? `Playing every ${Number(selected_card.autoplay_duration) || 3.5}s`
                            : 'Paused'
                          : 'Add 2+ slides to cycle automatically'}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'inline-flex',
                      backgroundColor: 'var(--lumen-surface, #ffffff)',
                      border: '1px solid var(--lumen-border, #cbd5e1)',
                      borderRadius: 6,
                      padding: 2,
                      gap: 2,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        updateCard(selected_card.id, { autoplay: false });
                        saveCurrentBoardToStore();
                        showToast('Carousel autoplay turned OFF');
                      }}
                      style={{
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: !selected_card.autoplay ? 600 : 500,
                        cursor: 'pointer',
                        backgroundColor: !selected_card.autoplay
                          ? 'var(--lumen-text-secondary, #475569)'
                          : 'transparent',
                        color: !selected_card.autoplay
                          ? '#ffffff'
                          : 'var(--lumen-text-secondary, #64748b)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Off
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const dur = Number(selected_card.autoplay_duration) || 3.5;
                        updateCard(selected_card.id, {
                          autoplay: true,
                          autoplay_duration: dur,
                        });
                        saveCurrentBoardToStore();
                        showToast(`Carousel autoplay turned ON (${dur}s per slide)`);
                      }}
                      style={{
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: selected_card.autoplay ? 600 : 500,
                        cursor: 'pointer',
                        backgroundColor: selected_card.autoplay
                          ? 'var(--lumen-accent, #2563eb)'
                          : 'transparent',
                        color: selected_card.autoplay
                          ? '#ffffff'
                          : 'var(--lumen-text-secondary, #64748b)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      On
                    </button>
                  </div>
                </div>

                {/* Row 2: Autoplay Duration (Seconds) */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    paddingTop: 8,
                    borderTop: '1px solid var(--lumen-border, #e2e8f0)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--lumen-text-secondary, #334155)',
                      }}
                    >
                      <Clock size={12} color="var(--lumen-accent, #2563eb)" />
                      <span>Slide Duration</span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="number"
                        min="0.5"
                        max="60"
                        step="0.5"
                        value={Number(selected_card.autoplay_duration) || 3.5}
                        onChange={(e) => {
                          const raw = parseFloat(e.target.value);
                          if (!isNaN(raw)) {
                            const clamped = Math.max(0.5, Math.min(60, raw));
                            updateCard(selected_card.id, { autoplay_duration: clamped });
                            saveCurrentBoardToStore();
                          }
                        }}
                        style={{
                          width: 54,
                          padding: '2px 6px',
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 5,
                          border: '1px solid var(--lumen-border, #cbd5e1)',
                          backgroundColor: 'var(--lumen-surface, #ffffff)',
                          color: 'var(--lumen-text-primary, #0f172a)',
                          textAlign: 'right',
                        }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--lumen-text-muted, #64748b)', fontWeight: 500 }}>
                        sec
                      </span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="0.5"
                    max="15"
                    step="0.5"
                    value={Math.min(15, Number(selected_card.autoplay_duration) || 3.5)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateCard(selected_card.id, { autoplay_duration: val });
                      saveCurrentBoardToStore();
                    }}
                    style={{ width: '100%', accentColor: 'var(--lumen-accent, #2563eb)', cursor: 'pointer' }}
                  />

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {[1.5, 2.5, 3.5, 5, 8, 10].map((preset_sec) => {
                      const cur_dur = Number(selected_card.autoplay_duration) || 3.5;
                      const is_preset_active = Math.abs(cur_dur - preset_sec) < 0.05;
                      return (
                        <button
                          key={preset_sec}
                          type="button"
                          onClick={() => {
                            updateCard(selected_card.id, { autoplay_duration: preset_sec });
                            saveCurrentBoardToStore();
                            showToast(`Slide duration set to ${preset_sec}s`);
                          }}
                          style={{
                            flex: 1,
                            minWidth: 38,
                            padding: '3px 6px',
                            fontSize: 10.5,
                            fontWeight: is_preset_active ? 600 : 500,
                            borderRadius: 5,
                            border: is_preset_active
                              ? '1px solid var(--lumen-accent, #2563eb)'
                              : '1px solid var(--lumen-border, #cbd5e1)',
                            backgroundColor: is_preset_active
                              ? 'rgba(37, 99, 235, 0.08)'
                              : 'var(--lumen-surface, #ffffff)',
                            color: is_preset_active
                              ? 'var(--lumen-accent, #2563eb)'
                              : 'var(--lumen-text-secondary, #475569)',
                            cursor: 'pointer',
                          }}
                        >
                          {preset_sec}s
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Hidden File Input for Image Upload */}
              <input
                ref={slide_file_input_ref}
                type="file"
                multiple
                accept="image/*"
                onChange={handle_file_upload_change}
                style={{ display: 'none' }}
              />

              {/* Upload Drop Zone / Button with Drag & Drop */}
              <div
                className={`${styles['lumen-property-upload-zone'] || styles.lumenPropertyUploadZone} ${
                  is_carousel_drag_over ? (styles['lumen-property-upload-zone-drag'] || styles.lumenPropertyUploadZoneDrag) : ''
                }`}
                onClick={() => slide_file_input_ref.current?.click()}
                onDragOver={handle_carousel_drag_over}
                onDragEnter={handle_carousel_drag_over}
                onDragLeave={handle_carousel_drag_leave}
                onDrop={handle_carousel_drop}
                title="Click or drag and drop multiple image files to upload"
              >
                <Upload
                  size={18}
                  color={is_carousel_drag_over ? '#ffffff' : 'var(--lumen-accent, #2563eb)'}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: is_carousel_drag_over ? '#ffffff' : 'var(--lumen-accent, #2563eb)',
                  }}
                >
                  {is_carousel_drag_over ? 'Drop image files here' : 'Upload Images / Add Slides'}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    color: is_carousel_drag_over ? 'rgba(255, 255, 255, 0.9)' : 'var(--lumen-text-muted, #94a3b8)',
                  }}
                >
                  Drag &amp; drop multiple files or click to browse (PNG, JPG, WebP)
                </span>
              </div>

              {/* Add Slide via URL */}
              <div className={styles['lumen-property-add-inline'] || styles.lumenPropertyAddInline}>
                <input
                  type="text"
                  value={new_slide_url}
                  onChange={(e) => set_new_slide_url(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handle_add_slide_url();
                  }}
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                  placeholder="Or paste image URL (https://...)"
                />
                <button
                  type="button"
                  className={styles['lumen-property-add-btn'] || styles.lumenPropertyAddBtn}
                  onClick={handle_add_slide_url}
                >
                  <Plus size={13} />
                  <span>Add URL</span>
                </button>
              </div>

              {/* Slides List with Reordering & Actions */}
              {slides.length > 0 && (
                <div className={styles['lumen-property-slides-list'] || styles.lumenPropertySlidesList}>
                  {slides.map((slide, idx) => (
                    <div
                      key={slide.id || idx}
                      className={`${styles['lumen-property-slide-item'] || styles.lumenPropertySlideItem} ${
                        active_slide_idx === idx
                          ? (styles['lumen-property-slide-item-active'] || styles.lumenPropertySlideItemActive)
                          : ''
                      }`}
                    >
                      <img
                        src={slide.url}
                        alt={`Slide ${idx + 1}`}
                        className={styles['lumen-property-slide-thumb'] || styles.lumenPropertySlideThumb}
                        onClick={() => handle_set_active_slide(idx)}
                      />
                      <div className={styles['lumen-property-slide-details'] || styles.lumenPropertySlideDetails}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, fontWeight: 600 }}>
                            Slide {idx + 1}
                            {active_slide_idx === idx && (
                              <span style={{ color: 'var(--lumen-accent)', marginLeft: 4 }}>• Active</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => handle_set_active_slide(idx)}
                            style={{
                              border: 'none',
                              background: 'none',
                              fontSize: 10,
                              color: active_slide_idx === idx ? 'var(--lumen-accent)' : 'var(--lumen-text-muted)',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            {active_slide_idx === idx ? 'Viewing' : 'Select'}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={slide.caption || ''}
                          onChange={(e) => handle_update_slide_caption(idx, e.target.value)}
                          placeholder="Slide caption..."
                          className={styles['lumen-property-slide-caption-input'] || styles.lumenPropertySlideCaptionInput}
                        />
                      </div>
                      <div className={styles['lumen-property-slide-actions'] || styles.lumenPropertySlideActions}>
                        <button
                          type="button"
                          className={styles['lumen-property-icon-mini-btn'] || styles.lumenPropertyIconMiniBtn}
                          onClick={() => {
                            showToast(`Downloading slide #${idx + 1}...`);
                            download_property_slide(slide, idx);
                          }}
                          title={`Download Slide #${idx + 1}`}
                          style={{ color: 'var(--lumen-accent, #2563eb)' }}
                        >
                          <Download size={11} />
                        </button>
                        <button
                          type="button"
                          className={styles['lumen-property-icon-mini-btn'] || styles.lumenPropertyIconMiniBtn}
                          onClick={() => handle_move_slide(idx, idx - 1)}
                          disabled={idx === 0}
                          title="Move Up"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          type="button"
                          className={styles['lumen-property-icon-mini-btn'] || styles.lumenPropertyIconMiniBtn}
                          onClick={() => handle_move_slide(idx, idx + 1)}
                          disabled={idx === slides.length - 1}
                          title="Move Down"
                        >
                          <ArrowDown size={11} />
                        </button>
                        <button
                          type="button"
                          className={styles['lumen-property-icon-mini-btn'] || styles.lumenPropertyIconMiniBtn}
                          onClick={() => handle_delete_slide(idx)}
                          title="Remove Slide"
                          style={{ color: '#dc2626' }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {slides.length > 0 && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className={styles['lumen-property-add-btn'] || styles.lumenPropertyAddBtn}
                    onClick={handle_property_download_current_slide}
                    style={{ flex: 1, justifyContent: 'center' }}
                    title={
                      slides.length > 1
                        ? `Download active image (Slide #${active_slide_idx + 1})`
                        : 'Download image'
                    }
                  >
                    <Download size={13} />
                    <span>
                      {slides.length > 1
                        ? `Download Slide #${active_slide_idx + 1}`
                        : 'Download Image'}
                    </span>
                  </button>

                  {slides.length > 1 && (
                    <button
                      type="button"
                      className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                      onClick={handle_property_download_all_slides}
                      style={{ flex: 1, justifyContent: 'center' }}
                      title={`Download all ${slides.length} slides in this carousel`}
                    >
                      <Download size={13} />
                      <span>Download All ({slides.length})</span>
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                onClick={() => {
                  openImageViewer({
                    cardId: selected_card.id,
                    title: selected_card.title || 'Moodboard Image',
                    slides: slides,
                    activeIndex: active_slide_idx,
                  });
                }}
              >
                <Maximize2 size={13} />
                <span>Open Fullscreen Lightbox</span>
              </button>

              {/* Image Card Note / Visual Mood & Creative Visualization Section */}
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--lumen-border, #e2e8f0)',
                  borderLeft: '3px solid var(--lumen-accent, #2563eb)',
                  backgroundColor: 'var(--lumen-surface-subtle, #f8fafc)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--lumen-accent, #2563eb)',
                    }}
                  >
                    <Sparkles size={12} />
                    <span>
                      {selected_card.ai_note_title ||
                        (selected_card.ai_notes ? 'Visual Mood & Lighting' : 'Image Card Note')}
                    </span>
                  </span>

                  {(selected_card.ai_notes || selected_card.content) && (
                    <button
                      type="button"
                      onClick={() => {
                        const current_h = Number(selected_card.height) || 464;
                        const restored_h =
                          current_h >= 440 && current_h <= 480
                            ? 360
                            : Math.max(260, current_h - 100);
                        updateCard(
                          selected_card.id,
                          {
                            ai_notes: '',
                            content: '',
                            ai_note_title: '',
                            image_note_height: 0,
                            base_height_without_note: null,
                            height: restored_h,
                          },
                          true
                        );
                        saveCurrentBoardToStore();
                        showToast('Removed note from Image Card');
                      }}
                      style={{
                        border: '1px solid rgba(239, 68, 68, 0.28)',
                        background: 'rgba(239, 68, 68, 0.08)',
                        color: '#dc2626',
                        borderRadius: 5,
                        padding: '2px 7px',
                        fontSize: 10.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Clear and hide this note from the Image Card"
                    >
                      <Trash2 size={11} />
                      <span>Clear Note</span>
                    </button>
                  )}
                </div>

                <div className={styles['lumen-property-field'] || styles.lumenPropertyField} style={{ margin: 0 }}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Note Header Label</span>
                    <span className={styles['lumen-property-label-hint'] || styles.lumenPropertyLabelHint}>
                      Shown above note on card
                    </span>
                  </label>
                  <input
                    type="text"
                    value={selected_card.ai_note_title || ''}
                    onChange={(e) =>
                      updateCard(selected_card.id, { ai_note_title: e.target.value })
                    }
                    placeholder="e.g. Visual Mood & Lighting, Love Poem, Note..."
                    className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                    style={{ fontSize: 11.5 }}
                  />
                </div>

                <div className={styles['lumen-property-field'] || styles.lumenPropertyField} style={{ margin: 0 }}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Image Card Note / Creative Visualization Text</span>
                  </label>
                  <textarea
                    rows={5}
                    value={selected_card.ai_notes || selected_card.content || ''}
                    onChange={(e) => {
                      const next_val = e.target.value;
                      updateCard(selected_card.id, {
                        ai_notes: next_val,
                        content: next_val,
                      });
                    }}
                    placeholder="Write a note, visual mood & lighting brief, poem, joke, or quote for this Image Card..."
                    className={styles['lumen-property-textarea'] || styles.lumenPropertyTextarea}
                    style={{ fontSize: 11.5, resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* COLOR PALETTE CARD: Swatches & Curated Presets */}
          {selected_card.type === 'palette' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <PaletteIcon size={12} color="var(--lumen-accent)" />
                  Color Swatches ({palette_colors.length})
                </span>
                <button
                  type="button"
                  onClick={handle_add_palette_color}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: 'var(--lumen-accent)',
                    fontSize: 10.5,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  + Add Swatch
                </button>
              </div>

              {/* Swatches List */}
              <div className={styles['lumen-property-palette-list'] || styles.lumenPropertyPaletteList}>
                {palette_colors.map((c, idx) => (
                  <div key={c.id || idx} className={styles['lumen-property-palette-row'] || styles.lumenPropertyPaletteRow}>
                    <input
                      type="color"
                      value={c.hex || '#000000'}
                      onChange={(e) => handle_update_palette_color(idx, { hex: e.target.value })}
                      style={{ width: 28, height: 28, border: '1px solid #cbd5e1', borderRadius: 6, padding: 0, cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={c.hex || ''}
                      onChange={(e) => handle_update_palette_color(idx, { hex: e.target.value })}
                      className={styles['lumen-property-hex-input'] || styles.lumenPropertyHexInput}
                      style={{ width: 80, flex: 'none' }}
                      placeholder="#000000"
                    />
                    <input
                      type="text"
                      value={c.name || ''}
                      onChange={(e) => handle_update_palette_color(idx, { name: e.target.value })}
                      className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                      placeholder="Color Name (e.g. Travertine)"
                    />
                    <button
                      type="button"
                      className={styles['lumen-property-icon-mini-btn'] || styles.lumenPropertyIconMiniBtn}
                      onClick={() => handle_delete_palette_color(idx)}
                      title="Remove Swatch"
                      style={{ color: '#dc2626' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Curated Aesthetic Presets */}
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField} style={{ marginTop: 6 }}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Apply Curated Mood Palette</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {CURATED_PALETTES.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handle_apply_curated_palette(preset)}
                      className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                      style={{ justifyContent: 'space-between', padding: '6px 10px', fontSize: 11 }}
                    >
                      <span style={{ fontWeight: 600 }}>{preset.name}</span>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {preset.colors.slice(0, 5).map((col, c_idx) => (
                          <span
                            key={c_idx}
                            style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: col.hex, display: 'inline-block' }}
                          />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DOCS CARD: Font Family & Size */}
          {selected_card.type === 'docs' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span>Document Typography</span>
              </div>
              <div className={styles['lumen-property-row'] || styles.lumenPropertyRow}>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Google Font (Free Commercial)</span>
                  </label>
                  <select
                    value={selected_card.font_family || selected_card.doc_font || 'Inter'}
                    onChange={(e) => {
                      const val = e.target.value;
                      load_google_font(val);
                      updateCard(selected_card.id, { font_family: val, doc_font: val });
                      saveCurrentBoardToStore();
                    }}
                    className={styles['lumen-property-select'] || styles.lumenPropertySelect}
                  >
                    {['sans-serif', 'serif', 'display', 'handwriting', 'monospace'].map((cat_key) => {
                      const cat_fonts = (googleFontsCatalogSignal.value || FREE_COMMERCIAL_GOOGLE_FONTS).filter(
                        (f) => f.category === cat_key
                      );
                      return (
                        <optgroup key={cat_key} label={`${cat_key.toUpperCase()} (${cat_fonts.length})`}>
                          {cat_fonts.map((f) => (
                            <option key={f.family} value={f.family}>
                              {f.family}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Font Size</span>
                  </label>
                  <select
                    value={String(selected_card.doc_font_size || '14px').replace('px', '')}
                    onChange={(e) => updateCard(selected_card.id, { doc_font_size: `${e.target.value}px` })}
                    className={styles['lumen-property-select'] || styles.lumenPropertySelect}
                  >
                    <option value="13">11 pt (13px)</option>
                    <option value="14">12 pt (14px)</option>
                    <option value="16">14 pt (16px)</option>
                    <option value="18">18 pt (18px)</option>
                    <option value="24">24 pt (24px)</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                onClick={() => window.dispatchEvent(new CustomEvent(`lumen-docs-fullscreen-${selected_card.id}`))}
              >
                <Maximize2 size={13} />
                <span>Open Fullscreen Focus Mode</span>
              </button>
            </div>
          )}

          {/* SHEETS CARD: Spreadsheet Controls */}
          {selected_card.type === 'sheets' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Table size={12} color="var(--lumen-accent)" />
                  Spreadsheet Studio
                </span>
              </div>
              <button
                type="button"
                className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                onClick={() => window.dispatchEvent(new CustomEvent(`lumen-sheets-fullscreen-${selected_card.id}`))}
              >
                <Maximize2 size={13} />
                <span>Open Fullscreen Grid Editor</span>
              </button>
            </div>
          )}

          {/* CANVAS CARD: Background Pattern & Fullscreen Studio */}
          {selected_card.type === 'canvas' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span>Drawing Canvas Settings</span>
              </div>
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Background Pattern</span>
                </label>
                <select
                  value={selected_card.canvas_bg_style || 'dots'}
                  onChange={(e) => updateCard(selected_card.id, { canvas_bg_style: e.target.value })}
                  className={styles['lumen-property-select'] || styles.lumenPropertySelect}
                >
                  <option value="dots">Dot Matrix</option>
                  <option value="grid">Isometric Grid</option>
                  <option value="blank">Blank Surface</option>
                </select>
              </div>
              <button
                type="button"
                className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                onClick={() => window.dispatchEvent(new CustomEvent(`lumen-canvas-fullscreen-${selected_card.id}`))}
              >
                <Maximize2 size={13} />
                <span>Open Fullscreen Drawing Studio</span>
              </button>
            </div>
          )}

          {/* CODING CARD: AI Function from Prompt — Generate Code Snippet */}
          {selected_card.type === 'code' && (() => {
            const code_data_obj = selected_card.code_data || {
              active_file_id: 'file_1',
              theme: 'dark',
              word_wrap: false,
              font_size: 13,
              files: [
                {
                  id: 'file_1',
                  name: 'snippet.js',
                  language: 'javascript',
                  code: selected_card.content || '',
                  pinned_lines: [],
                },
              ],
            };
            const code_files =
              Array.isArray(code_data_obj.files) && code_data_obj.files.length > 0
                ? code_data_obj.files
                : [
                    {
                      id: 'file_1',
                      name: 'snippet.js',
                      language: 'javascript',
                      code: selected_card.content || '',
                      pinned_lines: [],
                    },
                  ];
            const active_file_obj =
              code_files.find((f) => f.id === code_data_obj.active_file_id) || code_files[0];
            const active_lang = active_file_obj?.language || 'javascript';
            const coding_model = getSelectedAiModelForTask('coding');
            const is_busy = Boolean(isCardAiProcessingSignal.value);
            const code_lang_options = [
              { id: 'javascript', label: 'JavaScript', ext: 'js' },
              { id: 'typescript', label: 'TypeScript', ext: 'ts' },
              { id: 'python', label: 'Python', ext: 'py' },
              { id: 'go', label: 'Go (Golang)', ext: 'go' },
              { id: 'rust', label: 'Rust', ext: 'rs' },
              { id: 'sql', label: 'SQL (PostgreSQL)', ext: 'sql' },
              { id: 'html', label: 'HTML / Webpage', ext: 'html' },
              { id: 'css', label: 'CSS', ext: 'css' },
              { id: 'json', label: 'JSON', ext: 'json' },
              { id: 'bash', label: 'Bash / Shell', ext: 'sh' },
              { id: 'java', label: 'Java', ext: 'java' },
              { id: 'cpp', label: 'C / C++', ext: 'cpp' },
              { id: 'php', label: 'PHP', ext: 'php' },
              { id: 'ruby', label: 'Ruby', ext: 'rb' },
              { id: 'yaml', label: 'YAML', ext: 'yml' },
            ];
            const active_lang_label =
              code_lang_options.find((l) => l.id === active_lang)?.label || 'JavaScript';
            const is_html_code_card =
              active_lang === 'html' ||
              /\.(html?|svg)$/i.test(active_file_obj?.name || '') ||
              /^\s*(?:<!doctype\s+html|<html|<head|<body|<div|<section|<main|<header|<nav|<article|<style|<svg)\b/i.test(
                active_file_obj?.code || selected_card.content || ''
              ) ||
              code_files.some(
                (f) =>
                  String(f?.language || '').toLowerCase() === 'html' ||
                  /\.(html?)$/i.test(f?.name || '')
              );

            return (
              <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
                <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FileCode size={13} color="#7c3aed" />
                    <span>Coding Card · AI Generate Code Snippet</span>
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed' }}>
                    {coding_model?.badge || 'muse-wonder-1.0'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 10,
                    borderRadius: 10,
                    border: '1px solid rgba(124, 58, 237, 0.25)',
                    background: 'rgba(124, 58, 237, 0.04)',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: '#475569' }}>
                        Language ({active_file_obj?.name || 'snippet.js'})
                      </span>
                      <select
                        value={active_lang}
                        onChange={(e) => {
                          const new_lang = e.target.value;
                          const lang_meta = code_lang_options.find((l) => l.id === new_lang);
                          const updated_files = code_files.map((f) => {
                            if (f.id !== active_file_obj.id) return f;
                            let next_name = String(f.name || 'snippet.js').trim();
                            if (lang_meta) {
                              const clean_stem =
                                next_name.replace(/\.[a-z0-9]+$/i, '').replace(/_+$/g, '') ||
                                'snippet';
                              next_name = `${clean_stem}.${lang_meta.ext}`;
                            }
                            return { ...f, language: new_lang, name: next_name };
                          });
                          updateCard(
                            selected_card.id,
                            {
                              code_language: new_lang,
                              code_data: {
                                ...code_data_obj,
                                active_file_id: active_file_obj.id,
                                files: updated_files,
                              },
                            },
                            true
                          );
                        }}
                        className={styles['lumen-property-select'] || styles.lumenPropertySelect}
                        style={{ fontSize: 11, padding: '4px 7px' }}
                      >
                        {code_lang_options.map((lang) => (
                          <option key={lang.id} value={lang.id}>
                            {lang.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#475569',
                        paddingBottom: 5,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={panel_code_create_new_tab}
                        onChange={(e) => set_panel_code_create_new_tab(e.target.checked)}
                        style={{ accentColor: '#7c3aed', cursor: 'pointer' }}
                      />
                      <span>Create in new tab</span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(active_lang === 'html'
                      ? [
                          'Responsive SaaS landing page with pricing in HTML',
                          'Interactive analytics dashboard webpage in HTML',
                          'Portfolio hero & project showcase in HTML',
                          'Interactive calculator / Pomodoro app in HTML',
                        ]
                      : [
                          `Fetch helper with retry in ${active_lang_label}`,
                          `Debounce utility in ${active_lang_label}`,
                          `REST API handler in ${active_lang_label}`,
                          `Responsive HTML5 landing page`,
                        ]
                    ).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => set_panel_code_prompt_input(preset)}
                        style={{
                          border: '1px solid rgba(124, 58, 237, 0.25)',
                          background: 'var(--lumen-surface, #ffffff)',
                          color: '#5b21b6',
                          borderRadius: 5,
                          padding: '2px 7px',
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    value={panel_code_prompt_input}
                    onChange={(e) => set_panel_code_prompt_input(e.target.value.slice(0, 500))}
                    placeholder={`Enter prompt to generate ${active_lang_label} code snippet with muse-wonder-1.0 (e.g. responsive HTML landing page, JWT auth middleware, SQL CTE)...`}
                    className={styles['lumen-property-textarea'] || styles.lumenPropertyTextarea}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        const trimmed = panel_code_prompt_input.trim();
                        if (!trimmed || is_busy) return;
                        const inferred_html =
                          /\b(html|html5|webpage|web\s*page|landing\s*page|website|single\s*page|hero\s*section|invitation)\b/i.test(
                            trimmed
                          ) || /\.html?\b/i.test(trimmed);
                        set_panel_code_prompt_input('');
                        runAiCardAction(selected_card.id, 'code_generate_snippet', trimmed, {
                          target_language: inferred_html ? 'html' : active_lang,
                          create_new_tab: panel_code_create_new_tab,
                        });
                      }
                    }}
                  />

                  <button
                    type="button"
                    disabled={!panel_code_prompt_input.trim() || is_busy}
                    onClick={() => {
                      const trimmed = panel_code_prompt_input.trim();
                      if (!trimmed || is_busy) return;
                      const inferred_html =
                        /\b(html|html5|webpage|web\s*page|landing\s*page|website|single\s*page|hero\s*section|invitation)\b/i.test(
                          trimmed
                        ) || /\.html?\b/i.test(trimmed);
                      set_panel_code_prompt_input('');
                      runAiCardAction(selected_card.id, 'code_generate_snippet', trimmed, {
                        target_language: inferred_html ? 'html' : active_lang,
                        create_new_tab: panel_code_create_new_tab,
                      });
                    }}
                    className={styles['lumen-property-ai-btn'] || styles.lumenPropertyAiBtn}
                    style={{ padding: '6px 10px', fontSize: 11.5 }}
                  >
                    <Sparkles size={12} />
                    <span>
                      {is_busy
                        ? 'Generating with muse-wonder-1.0...'
                        : `Generate ${active_lang_label} Snippet (muse-wonder-1.0)`}
                    </span>
                  </button>

                  {is_html_code_card && (
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent(`lumen-code-web-preview-${selected_card.id}`)
                        );
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '7px 10px',
                        borderRadius: 7,
                        border: '1px solid rgba(16, 185, 129, 0.45)',
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#047857',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                      title="Open HTML Webpage Preview in Fullscreen with Desktop, Laptop, Tablet & Mobile Device Selector"
                    >
                      <Globe size={13} />
                      <span>Preview Webpage in Fullscreen (Device Selector)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Card Content / Markdown / Notes (for notes, quotes, or general content) */}
          {(selected_card.type === 'note' ||
            selected_card.type === 'docs' ||
            selected_card.type === 'quote' ||
            (selected_card.content !== undefined &&
              selected_card.type !== 'image' &&
              selected_card.type !== 'tasklist' &&
              selected_card.type !== 'stock' &&
              selected_card.type !== 'code')) && (
            <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
              <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                <span>Content / Note Text</span>
                <span className={styles['lumen-property-label-hint'] || styles.lumenPropertyLabelHint}>
                  Markdown supported
                </span>
              </label>
              <textarea
                value={selected_card.content || ''}
                onChange={handle_content_change}
                className={styles['lumen-property-textarea'] || styles.lumenPropertyTextarea}
                placeholder="Write notes, descriptions, or annotations..."
                rows={4}
              />
            </div>
          )}

          {/* Voice (Text-to-Voice) Result & Controls on Note / Text Cards */}
          {(selected_card.type === 'note' ||
            Boolean(selected_card.tts_audio_url || selected_card.tts_audio_base64)) && (
            <div
              className={styles['lumen-property-field'] || styles.lumenPropertyField}
              style={{
                padding: 10,
                borderRadius: 10,
                border: '1px solid rgba(124, 58, 237, 0.24)',
                background: 'rgba(124, 58, 237, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#5b21b6',
                  }}
                >
                  <Volume2 size={13} color="#7c3aed" />
                  <span>Voice Result (Google TTS)</span>
                </span>
                {(selected_card.tts_audio_url || selected_card.tts_audio_base64) && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {(selected_card.tts_download_url || selected_card.tts_audio_url) && (
                      <a
                        href={selected_card.tts_download_url || selected_card.tts_audio_url}
                        download={selected_card.tts_file_name || 'google_tts_note.wav'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10.5,
                          fontWeight: 600,
                          color: '#5b21b6',
                          textDecoration: 'none',
                          padding: '2px 6px',
                          borderRadius: 5,
                          background: 'rgba(124, 58, 237, 0.1)',
                        }}
                        title="Download Voice 24kHz WAV"
                      >
                        <Download size={11} />
                        <span>WAV</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => clearCardMuseVoiceResult(selected_card.id)}
                      style={{
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        background: 'rgba(239, 68, 68, 0.08)',
                        color: '#dc2626',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: 5,
                        fontSize: 10.5,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Delete Voice result"
                    >
                      <Trash2 size={11} />
                      <span>Delete</span>
                    </button>
                  </span>
                )}
              </div>

              {(selected_card.tts_audio_url || selected_card.tts_audio_base64) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 10.5,
                      color: '#6d28d9',
                    }}
                  >
                    <span>
                      Google TTS Voice: <strong>{normalize_panel_muse_voice_id(selected_card.tts_voice_persona)}</strong>
                      {selected_card.tts_language ? ` · ${selected_card.tts_language}` : ''}
                    </span>
                    {selected_card.tts_audio_duration ? (
                      <span>{selected_card.tts_audio_duration}s</span>
                    ) : null}
                  </div>
                  <audio
                    key={selected_card.tts_file_id || selected_card.tts_audio_url || 'panel-note-tts'}
                    controls
                    preload="metadata"
                    src={selected_card.tts_audio_url || selected_card.tts_audio_base64}
                    style={{ width: '100%', height: 32 }}
                  />
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  No synthesized voice audio yet. Select a voice persona and language below to generate Voice from this note&apos;s content.
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                  marginTop: 2,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>
                    Google TTS Voice
                  </span>
                  <select
                    value={panel_tts_voice}
                    onChange={(e) => {
                      const next_v = e.target.value;
                      set_panel_tts_voice(next_v);
                      updateCard(selected_card.id, { tts_voice_persona: next_v }, true);
                    }}
                    className={styles['lumen-property-select'] || styles.lumenPropertySelect}
                    style={{ fontSize: 11, padding: '4px 6px' }}
                  >
                    {MUSE_VOICE_PERSONA_CATEGORIES.map((cat) => (
                      <optgroup key={cat} label={cat}>
                        {MUSE_VOICE_PERSONA_OPTIONS.filter((vo) => vo.category === cat).map(
                          (vo) => (
                            <option key={vo.id} value={vo.id}>
                              {vo.label}
                            </option>
                          )
                        )}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>
                    Spoken Language
                  </span>
                  <select
                    value={panel_tts_lang}
                    onChange={(e) => {
                      const next_l = e.target.value;
                      set_panel_tts_lang(next_l);
                      updateCard(selected_card.id, { tts_language: next_l }, true);
                    }}
                    className={styles['lumen-property-select'] || styles.lumenPropertySelect}
                    style={{ fontSize: 11, padding: '4px 6px' }}
                  >
                    {MUSE_VOICE_LANGUAGE_OPTIONS.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                disabled={Boolean(isCardAiProcessingSignal.value)}
                onClick={() => {
                  updateCard(
                    selected_card.id,
                    {
                      tts_voice_persona: panel_tts_voice,
                      tts_language: panel_tts_lang,
                    },
                    true
                  );
                  runAiCardAction(
                    selected_card.id,
                    'note_text_to_voice',
                    `[voice:${panel_tts_voice}][lang:${panel_tts_lang}]`
                  );
                }}
                className={styles['lumen-property-ai-btn'] || styles.lumenPropertyAiBtn}
                style={{ marginTop: 2, padding: '6px 10px', fontSize: 11.5 }}
              >
                <Volume2 size={12} />
                <span>
                  {isCardAiProcessingSignal.value?.cardId === selected_card.id &&
                  isCardAiProcessingSignal.value?.actionId === 'note_text_to_voice'
                    ? 'Synthesizing with Google TTS...'
                    : selected_card.tts_audio_url || selected_card.tts_audio_base64
                    ? `Regenerate Voice with Google TTS (${panel_tts_voice})`
                    : `Generate Voice with Google TTS (${panel_tts_voice})`}
                </span>
              </button>
            </div>
          )}

          {/* Description or Subtitle */}
          {(selected_card.type === 'link' ||
            selected_card.type === 'group' ||
            selected_card.type === 'file' ||
            selected_card.type === 'board' ||
            selected_card.type === 'embed' ||
            selected_card.type === 'social' ||
            selected_card.type === 'stock' ||
            selected_card.description !== undefined) && (
            <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
              <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                <span>Description / Subtitle</span>
              </label>
              <input
                type="text"
                value={selected_card.description || ''}
                onChange={handle_description_change}
                className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                placeholder="Brief summary or description..."
              />
            </div>
          )}

          {/* External URL / Media & Resource Link (For non-location and non-file cards) */}
          {selected_card.type !== 'geo' && selected_card.type !== 'location' && selected_card.type !== 'file' && (
            <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
              <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <LinkIcon size={12} color="var(--lumen-accent, #2563eb)" />
                  <span>
                    {selected_card.type === 'embed' || selected_card.type === 'social'
                      ? 'Embed Platform URL'
                      : 'URL / External Link'}
                  </span>
                </div>
                {selected_card.url && (
                  <a
                    href={selected_card.url.startsWith('http://') || selected_card.url.startsWith('https://') ? selected_card.url : `https://${selected_card.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 10.5,
                      color: 'var(--lumen-accent, #2563eb)',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <span>Open</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </label>
              <div className={styles['lumen-property-geo-url-row'] || styles.lumenPropertyGeoUrlRow}>
                <input
                  type="text"
                  value={selected_card.url || ''}
                  onChange={handle_url_change}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                  placeholder="Paste web link (https://...)..."
                />
                <button
                  type="button"
                  className={styles['lumen-property-geo-action-btn'] || styles.lumenPropertyGeoActionBtn}
                  onClick={handle_paste_card_url}
                  title="Paste URL from clipboard"
                >
                  <span>Paste</span>
                </button>
                {selected_card.type === 'link' && selected_card.url && (
                  <button
                    type="button"
                    className={styles['lumen-property-geo-action-btn'] || styles.lumenPropertyGeoActionBtn}
                    onClick={handle_refresh_weblink_metadata}
                    title="Fetch & Refresh OpenGraph title, image and status"
                  >
                    <RefreshCw
                      size={11}
                      style={{
                        animation: is_property_fetching_link ? 'spin 1s linear infinite' : 'none',
                      }}
                    />
                    <span>{is_property_fetching_link ? 'Fetching...' : 'Fetch'}</span>
                  </button>
                )}
                {selected_card.url && (
                  <button
                    type="button"
                    className={styles['lumen-property-geo-search-clear'] || styles.lumenPropertyGeoSearchClear}
                    onClick={() => updateCard(selected_card.id, { url: '' })}
                    title="Clear URL"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Upload File Field for File Cards */}
          {selected_card.type === 'file' && (
            <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
              <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Upload size={12} color="var(--lumen-accent, #2563eb)" />
                  <span>Upload File</span>
                </div>
                {selected_card.file_extension && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '1px 5px',
                      borderRadius: 4,
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      color: 'var(--lumen-accent, #2563eb)',
                    }}
                  >
                    {selected_card.file_extension}
                  </span>
                )}
              </label>

              {/* Upload Drop Zone & Browse Files */}
              <div
                className={`${styles['lumen-property-upload-zone'] || styles.lumenPropertyUploadZone} ${
                  is_property_dragging
                    ? (styles['lumen-property-upload-zone-drag'] || styles.lumenPropertyUploadZoneDrag)
                    : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  set_is_property_dragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  set_is_property_dragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  set_is_property_dragging(false);
                  const f = e.dataTransfer?.files?.[0];
                  if (f) handle_property_upload_file(f);
                }}
                onClick={() => {
                  if (property_file_input_ref.current && !is_property_uploading) {
                    property_file_input_ref.current.value = '';
                    property_file_input_ref.current.click();
                  }
                }}
              >
                <input
                  ref={property_file_input_ref}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handle_property_upload_file(f);
                  }}
                />

                {is_property_uploading ? (
                  <div className={styles['lumen-property-upload-content'] || styles.lumenPropertyUploadContent}>
                    <div className={styles['lumen-property-upload-spinner'] || styles.lumenPropertyUploadSpinner} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--lumen-text-primary, #0f172a)' }}>
                      Uploading file...
                    </span>
                  </div>
                ) : (selected_card.file_name || selected_card.file_data || selected_card.file_url || selected_card.file_id) ? (
                  <div className={styles['lumen-property-file-attached-wrap'] || styles.lumenPropertyFileAttachedWrap}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--lumen-accent, #2563eb)',
                          flexShrink: 0,
                        }}
                      >
                        <FileText size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--lumen-text-primary, #0f172a)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {selected_card.file_name || selected_card.title || 'Attached File'}
                        </span>
                        <span style={{ fontSize: 10.5, color: 'var(--lumen-text-muted, #94a3b8)' }}>
                          {selected_card.file_size
                            ? `${(selected_card.file_size / 1024).toFixed(1)} KB`
                            : 'File attached'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, width: '100%', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={styles['lumen-property-file-download-btn'] || styles.lumenPropertyFileDownloadBtn}
                        onClick={handle_property_download_file}
                        title="Download attached file"
                      >
                        <Download size={12} />
                        <span>Download</span>
                      </button>
                      <button
                        type="button"
                        className={styles['lumen-property-browse-btn'] || styles.lumenPropertyBrowseBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (property_file_input_ref.current) {
                            property_file_input_ref.current.value = '';
                            property_file_input_ref.current.click();
                          }
                        }}
                      >
                        <Upload size={12} />
                        <span>Browse files</span>
                      </button>
                      <button
                        type="button"
                        className={styles['lumen-property-file-remove-btn'] || styles.lumenPropertyFileRemoveBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handle_property_remove_file();
                        }}
                        title="Remove attached file"
                      >
                        <Trash2 size={12} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles['lumen-property-upload-empty'] || styles.lumenPropertyUploadEmpty}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--lumen-accent, #2563eb)',
                        marginBottom: 6,
                      }}
                    >
                      <Upload size={18} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--lumen-text-primary, #0f172a)', marginBottom: 2 }}>
                      Upload file
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--lumen-text-muted, #64748b)', textAlign: 'center', marginBottom: 10 }}>
                      Drag and drop file here, or browse from device (up to 88MB)
                    </span>
                    <button
                      type="button"
                      className={styles['lumen-property-browse-btn'] || styles.lumenPropertyBrowseBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (property_file_input_ref.current) {
                          property_file_input_ref.current.value = '';
                          property_file_input_ref.current.click();
                        }
                      }}
                    >
                      <Upload size={12} />
                      <span>Browse files</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Embed & Social Platform Selection */}
          {(selected_card.type === 'embed' || selected_card.type === 'social') && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span>Embed Provider</span>
              </div>
              <div className={styles['lumen-property-row'] || styles.lumenPropertyRow}>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Platform</span>
                  </label>
                  <select
                    value={selected_card.platform || 'spotify'}
                    onChange={(e) => updateCard(selected_card.id, { platform: e.target.value })}
                    className={styles['lumen-property-select'] || styles.lumenPropertySelect}
                  >
                    <option value="spotify">Spotify</option>
                    <option value="soundcloud">SoundCloud</option>
                    <option value="youtube">YouTube / Shorts</option>
                    <option value="instagram">Instagram Reel / Post</option>
                    <option value="tiktok">TikTok</option>
                    <option value="vimeo">Vimeo</option>
                    <option value="bilibili">Bilibili</option>
                    <option value="pinterest">Pinterest</option>
                    <option value="x">X (Twitter)</option>
                    <option value="threads">Threads</option>
                    <option value="figma">Figma</option>
                    <option value="codepen">CodePen</option>
                    <option value="generic">Web Embed</option>
                  </select>
                </div>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Media Type</span>
                  </label>
                  <input
                    type="text"
                    value={selected_card.social_type || 'media'}
                    onChange={(e) => updateCard(selected_card.id, { social_type: e.target.value })}
                    className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                    placeholder="track, reel, video"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Type-Specific: Tasklist Items Checklist Editor */}
          {selected_card.type === 'tasklist' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span>Checklist Items ({task_items.length})</span>
                {task_items.length > 0 && (
                  <span>
                    {completed_tasks}/{task_items.length} done
                  </span>
                )}
              </div>

              {task_items.length > 0 && (
                <div className={styles['lumen-property-progress-wrap'] || styles.lumenPropertyProgressWrap}>
                  <div className={styles['lumen-property-progress-bar'] || styles.lumenPropertyProgressBar}>
                    <div
                      className={styles['lumen-property-progress-fill'] || styles.lumenPropertyProgressFill}
                      style={{ width: `${task_progress_pct}%` }}
                    />
                  </div>
                </div>
              )}

              <div className={styles['lumen-property-task-list'] || styles.lumenPropertyTaskList}>
                {task_items.map((item) => (
                  <div
                    key={item.id}
                    className={styles['lumen-property-task-item'] || styles.lumenPropertyTaskItem}
                  >
                    <button
                      type="button"
                      className={styles['lumen-property-task-checkbox'] || styles.lumenPropertyTaskCheckbox}
                      onClick={() => handle_toggle_task_item(item.id)}
                      style={{ background: 'none', border: 'none', padding: 0, display: 'flex' }}
                    >
                      {item.done ? (
                        <CheckSquare size={14} color="var(--lumen-accent, #2563eb)" />
                      ) : (
                        <Square size={14} color="var(--lumen-text-muted, #94a3b8)" />
                      )}
                    </button>
                    <textarea
                      rows={1}
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = `${Math.max(18, el.scrollHeight)}px`;
                        }
                      }}
                      value={item.text || ''}
                      onChange={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.max(18, e.target.scrollHeight)}px`;
                        handle_update_task_text(item.id, e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      className={`${styles['lumen-property-task-input'] || styles.lumenPropertyTaskInput} ${
                        item.done
                          ? (styles['lumen-property-task-input-done'] || styles.lumenPropertyTaskInputDone)
                          : ''
                      }`}
                    />
                    <button
                      type="button"
                      className={styles['lumen-property-task-delete'] || styles.lumenPropertyTaskDelete}
                      onClick={() => handle_delete_task_item(item.id)}
                      title="Delete task item"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <div className={styles['lumen-property-add-inline'] || styles.lumenPropertyAddInline}>
                <input
                  type="text"
                  value={new_task_text}
                  onChange={(e) => set_new_task_text(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handle_add_task_item();
                  }}
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                  placeholder="Add new task item..."
                />
                <button
                  type="button"
                  className={styles['lumen-property-add-btn'] || styles.lumenPropertyAddBtn}
                  onClick={handle_add_task_item}
                >
                  <Plus size={13} />
                  <span>Add</span>
                </button>
              </div>
            </div>
          )}

          {/* Type-Specific: Code Snippet Language & Content */}
          {selected_card.type === 'code' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span>Code Settings</span>
              </div>
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Programming Language</span>
                </label>
                <select
                  value={selected_card.language || 'javascript'}
                  onChange={(e) => updateCard(selected_card.id, { language: e.target.value })}
                  className={styles['lumen-property-select'] || styles.lumenPropertySelect}
                >
                  {CODE_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Code Snippet</span>
                </label>
                <textarea
                  value={selected_card.code_content || selected_card.content || ''}
                  onChange={(e) =>
                    updateCard(selected_card.id, {
                      code_content: e.target.value,
                      content: e.target.value,
                    })
                  }
                  className={styles['lumen-property-code-textarea'] || styles.lumenPropertyCodeTextarea}
                  rows={6}
                />
              </div>
            </div>
          )}


          {/* Type-Specific: File Card Specifications */}
          {selected_card.type === 'file' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span>File Specifications</span>
              </div>
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>File Name</span>
                </label>
                <input
                  type="text"
                  value={selected_card.file_name || selected_card.title || ''}
                  onChange={(e) =>
                    updateCard(selected_card.id, {
                      file_name: e.target.value,
                      title: e.target.value,
                    })
                  }
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                />
              </div>
              <div className={styles['lumen-property-row'] || styles.lumenPropertyRow}>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Extension</span>
                  </label>
                  <input
                    type="text"
                    value={selected_card.file_extension || ''}
                    placeholder="e.g. pdf, glb"
                    onChange={(e) =>
                      updateCard(selected_card.id, { file_extension: e.target.value })
                    }
                    className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                  />
                </div>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>File Size (bytes)</span>
                  </label>
                  <input
                    type="number"
                    value={selected_card.file_size || ''}
                    placeholder="0"
                    onChange={(e) =>
                      updateCard(selected_card.id, { file_size: parseInt(e.target.value, 10) || 0 })
                    }
                    className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                  />
                </div>
              </div>
              <button
                type="button"
                className={styles['lumen-property-file-download-btn'] || styles.lumenPropertyFileDownloadBtn}
                onClick={handle_property_download_file}
                style={{ width: '100%', marginTop: 4 }}
                title="Download attached file"
              >
                <Download size={13} />
                <span>Download File</span>
              </button>
            </div>
          )}

          {/* Type-Specific: Heading Card Level & Align */}
          {selected_card.type === 'heading' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span>Heading Hierarchy</span>
              </div>
              <div className={styles['lumen-property-row'] || styles.lumenPropertyRow}>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Heading Level</span>
                  </label>
                  <select
                    value={selected_card.heading_size || 'h2'}
                    onChange={(e) => updateCard(selected_card.id, { heading_size: e.target.value })}
                    className={styles['lumen-property-select'] || styles.lumenPropertySelect}
                  >
                    <option value="h1">H1 (Major Section - 32px)</option>
                    <option value="h2">H2 (Standard Header - 24px)</option>
                    <option value="h3">H3 (Sub-Section - 18px)</option>
                  </select>
                </div>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Text Alignment</span>
                  </label>
                  <select
                    value={selected_card.align || 'left'}
                    onChange={(e) => updateCard(selected_card.id, { align: e.target.value })}
                    className={styles['lumen-property-select'] || styles.lumenPropertySelect}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Type-Specific: Quote Card Attribution */}
          {selected_card.type === 'quote' && (
            <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
              <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                <span>Quote Attribution / Author</span>
              </label>
              <input
                type="text"
                value={selected_card.author || ''}
                onChange={(e) => updateCard(selected_card.id, { author: e.target.value })}
                className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                placeholder="e.g. Mies van der Rohe"
              />
            </div>
          )}

          {/* Type-Specific: Nested Board Card */}
          {selected_card.type === 'board' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FolderTree size={12} color="var(--lumen-accent)" />
                  Nested Sub-Board Link
                </span>
              </div>
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Target Board ID</span>
                </label>
                <input
                  type="text"
                  value={selected_card.target_board_id || ''}
                  onChange={(e) => updateCard(selected_card.id, { target_board_id: e.target.value })}
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                  placeholder="board_..."
                />
              </div>
              {selected_card.target_board_id && (
                <button
                  type="button"
                  className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                  onClick={() => {
                    setActiveBoard(selected_card.target_board_id);
                    showToast(`Navigated to sub-board`);
                  }}
                >
                  <ExternalLink size={13} />
                  <span>Enter Nested Board</span>
                </button>
              )}
            </div>
          )}

          {/* Type-Specific: Group Card Frame */}
          {selected_card.type === 'group' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Boxes size={12} color="var(--lumen-accent)" />
                  Group Frame Settings ({(selected_card.card_ids || []).length} items)
                </span>
              </div>
              <div className={styles['lumen-property-row'] || styles.lumenPropertyRow}>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Layout Mode</span>
                  </label>
                  <select
                    value={selected_card.layout || 'column'}
                    onChange={(e) => updateCard(selected_card.id, { layout: e.target.value })}
                    className={styles['lumen-property-select'] || styles.lumenPropertySelect}
                  >
                    <option value="column">Column Stack (Auto Layout)</option>
                    <option value="freeform">Freeform Placement</option>
                  </select>
                </div>
                <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                  <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                    <span>Column Width (px)</span>
                  </label>
                  <input
                    type="number"
                    value={selected_card.column_width || 340}
                    onChange={(e) =>
                      updateCard(selected_card.id, { column_width: parseInt(e.target.value, 10) })
                    }
                    className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Card Encryption */}
      {active_tab === 'encryption' && (() => {
        const enc_meta = selected_card.card_encryption || selected_card.cardEncryption;
        const is_encrypted = Boolean(enc_meta && enc_meta.ciphertext);
        const is_unlocked = Boolean(unlockedCardsSignal.value[selected_card.id] || selected_card.is_encryption_unlocked);

        const handle_encrypt_card = async (e) => {
          if (e) e.preventDefault();
          if (!enc_new_passkey) {
            set_enc_error_msg('Please enter a passkey');
            return;
          }
          const policy = validate_passkey_policy(enc_new_passkey);
          if (!policy.is_valid) {
            set_enc_error_msg(policy.message || 'Passkey must be at least 10 characters with mixed case, numbers, and symbols (e.g., K9#mQ2$vL8)');
            return;
          }
          if (enc_new_passkey !== enc_confirm_passkey) {
            set_enc_error_msg('Passkeys do not match');
            return;
          }

          set_enc_error_msg('');
          set_is_encrypting_card(true);
          try {
            await encryptExistingCard(selected_card.id, enc_new_passkey, enc_passkey_hint);
            set_enc_new_passkey('');
            set_enc_confirm_passkey('');
            set_enc_passkey_hint('');
          } catch (err) {
            set_enc_error_msg(err.message || 'Encryption failed');
          } finally {
            set_is_encrypting_card(false);
          }
        };

        const handle_unlock_in_panel = async (e) => {
          if (e) e.preventDefault();
          if (!panel_unlock_passkey) {
            set_panel_unlock_error('Please enter passkey');
            return;
          }
          set_panel_unlock_error('');
          set_is_unlocking_in_panel(true);
          try {
            await unlockCard(selected_card.id, panel_unlock_passkey);
            set_panel_unlock_passkey('');
          } catch (err) {
            set_panel_unlock_error(err.message || 'Incorrect passkey');
          } finally {
            set_is_unlocking_in_panel(false);
          }
        };

        const handle_change_passkey_submit = async (e) => {
          if (e) e.preventDefault();
          if (!change_new_passkey) {
            set_change_error_msg('Enter new passkey');
            return;
          }
          const policy = validate_passkey_policy(change_new_passkey);
          if (!policy.is_valid) {
            set_change_error_msg(policy.message || 'Passkey must be at least 10 characters with mixed case, numbers, and symbols (e.g., K9#mQ2$vL8)');
            return;
          }
          if (change_new_passkey !== change_confirm_passkey) {
            set_change_error_msg('New passkeys do not match');
            return;
          }
          set_change_error_msg('');
          set_is_changing_passkey(true);
          try {
            await changeCardPasskey(
              selected_card.id,
              change_old_passkey,
              change_new_passkey,
              change_new_hint
            );
            set_change_old_passkey('');
            set_change_new_passkey('');
            set_change_confirm_passkey('');
            set_change_new_hint('');
            set_show_change_form(false);
          } catch (err) {
            set_change_error_msg(err.message || 'Failed to update passkey');
          } finally {
            set_is_changing_passkey(false);
          }
        };

        const handle_decrypt_permanently = async (e) => {
          if (e) e.preventDefault();
          if (!is_unlocked && !decrypt_passkey_input) {
            set_decrypt_error_msg('Please enter passkey to verify decryption');
            return;
          }
          set_decrypt_error_msg('');
          set_is_decrypting_permanently(true);
          try {
            const passkey = is_unlocked
              ? unlockedCardsSignal.value[selected_card.id]?.passkey || decrypt_passkey_input
              : decrypt_passkey_input;
            await decryptCardPermanently(selected_card.id, passkey);
            set_show_decrypt_confirm(false);
            set_decrypt_passkey_input('');
          } catch (err) {
            set_decrypt_error_msg(err.message || 'Decryption failed');
          } finally {
            set_is_decrypting_permanently(false);
          }
        };

        return (
          <div className={styles['lumen-property-body'] || styles.lumenPropertyBody}>
            {!is_encrypted ? (
              // CASE 1: Card is currently normal unencrypted -> Option to Encrypt
              <>
                <div className={styles['lumen-property-enc-banner'] || styles.lumenPropertyEncBanner}>
                  <div className={styles['lumen-property-enc-icon-wrap'] || styles.lumenPropertyEncIconWrap}>
                    <Shield size={18} />
                  </div>
                  <div className={styles['lumen-property-enc-banner-text'] || styles.lumenPropertyEncBannerText}>
                    <span className={styles['lumen-property-enc-banner-title'] || styles.lumenPropertyEncBannerTitle}>
                      Normal Card (Unencrypted)
                    </span>
                    <span className={styles['lumen-property-enc-banner-desc'] || styles.lumenPropertyEncBannerDesc}>
                      Protect this card's content and data using AES-GCM 256-bit encryption. When locked, it will prompt for a passkey.
                    </span>
                  </div>
                </div>

                <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
                  <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                    <span>Encrypt Card Data</span>
                  </div>

                  <form onSubmit={handle_encrypt_card}>
                    <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                      <div className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                        <span>Set Passkey * (10+ chars, Mixed + Symbols)</span>
                        <button
                          type="button"
                          onClick={() => {
                            const strong = generate_strong_passkey(16);
                            set_enc_new_passkey(strong);
                            set_enc_confirm_passkey(strong);
                            set_show_enc_new_passkey(true);
                            if (navigator.clipboard) navigator.clipboard.writeText(strong).catch(() => {});
                            showToast('Generated & copied strong 16-char passkey');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--lumen-accent, #2563eb)',
                            fontSize: 10.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          + Generate
                        </button>
                      </div>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={show_enc_new_passkey ? 'text' : 'password'}
                          value={enc_new_passkey}
                          onChange={(e) => {
                            set_enc_new_passkey(e.target.value);
                            if (enc_error_msg) set_enc_error_msg('');
                          }}
                          className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                          placeholder="e.g., K9#mQ2$vL8"
                          style={{ paddingRight: 32 }}
                        />
                        <button
                          type="button"
                          onClick={() => set_show_enc_new_passkey(!show_enc_new_passkey)}
                          style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                          tabIndex={-1}
                        >
                          {show_enc_new_passkey ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>

                      {/* Policy Requirement Live Pills */}
                      {(() => {
                        const pol = validate_passkey_policy(enc_new_passkey);
                        return (
                          <div className={styles['lumen-property-policy-box'] || styles.lumenPropertyPolicyBox} style={{ marginTop: 4 }}>
                            <div className={styles['lumen-property-policy-row'] || styles.lumenPropertyPolicyRow}>
                              <span style={{ fontWeight: 600 }}>Policy: 10 chars (Mixed + Symbols) (e.g., K9#mQ2$vL8)</span>
                              <span style={{ fontWeight: 700, color: pol.is_valid ? '#10b981' : '#f97316' }}>
                                {pol.passed_count}/5
                              </span>
                            </div>
                            <div className={styles['lumen-property-policy-pills'] || styles.lumenPropertyPolicyPills}>
                              <span className={`${styles['lumen-property-policy-pill'] || styles.lumenPropertyPolicyPill} ${pol.length ? (styles['lumen-property-policy-pill-valid'] || styles.lumenPropertyPolicyPillValid) : ''}`}>
                                10+ Chars ({enc_new_passkey.length}/10)
                              </span>
                              <span className={`${styles['lumen-property-policy-pill'] || styles.lumenPropertyPolicyPill} ${pol.upper ? (styles['lumen-property-policy-pill-valid'] || styles.lumenPropertyPolicyPillValid) : ''}`}>
                                Uppercase
                              </span>
                              <span className={`${styles['lumen-property-policy-pill'] || styles.lumenPropertyPolicyPill} ${pol.lower ? (styles['lumen-property-policy-pill-valid'] || styles.lumenPropertyPolicyPillValid) : ''}`}>
                                Lowercase
                              </span>
                              <span className={`${styles['lumen-property-policy-pill'] || styles.lumenPropertyPolicyPill} ${pol.number ? (styles['lumen-property-policy-pill-valid'] || styles.lumenPropertyPolicyPillValid) : ''}`}>
                                Number
                              </span>
                              <span className={`${styles['lumen-property-policy-pill'] || styles.lumenPropertyPolicyPill} ${pol.symbol ? (styles['lumen-property-policy-pill-valid'] || styles.lumenPropertyPolicyPillValid) : ''}`}>
                                Symbol
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                      <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                        <span>Confirm Passkey *</span>
                        {enc_confirm_passkey && (
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: enc_new_passkey === enc_confirm_passkey ? '#10b981' : '#ef4444' }}>
                            {enc_new_passkey === enc_confirm_passkey ? 'Matches' : 'Does not match'}
                          </span>
                        )}
                      </label>
                      <input
                        type={show_enc_new_passkey ? 'text' : 'password'}
                        value={enc_confirm_passkey}
                        onChange={(e) => {
                          set_enc_confirm_passkey(e.target.value);
                          if (enc_error_msg) set_enc_error_msg('');
                        }}
                        className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                        placeholder="e.g., K9#mQ2$vL8"
                      />
                    </div>

                    <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                      <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                        <span>Passkey Hint (Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={enc_passkey_hint}
                        onChange={(e) => set_enc_passkey_hint(e.target.value)}
                        className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                        placeholder="e.g. Studio project secret codename"
                      />
                    </div>

                    {enc_error_msg && (
                      <div className={styles['lumen-property-enc-error'] || styles.lumenPropertyEncError}>
                        {enc_error_msg}
                      </div>
                    )}

                    <div style={{ marginTop: 12 }}>
                      <button
                        type="submit"
                        className={styles['lumen-property-enc-btn'] || styles.lumenPropertyEncBtn}
                        disabled={is_encrypting_card || !enc_new_passkey || !validate_passkey_policy(enc_new_passkey).is_valid || enc_new_passkey !== enc_confirm_passkey}
                      >
                        <Lock size={13} />
                        <span>{is_encrypting_card ? 'Encrypting...' : 'Encrypt This Card'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              // CASE 2: Card is already encrypted -> Status, Lock/Unlock, Change Passkey, Decrypt Permanently
              <>
                <div
                  className={`${styles['lumen-property-enc-banner'] || styles.lumenPropertyEncBanner} ${
                    is_unlocked
                      ? (styles['lumen-property-enc-banner-unlocked'] || styles.lumenPropertyEncBannerUnlocked)
                      : (styles['lumen-property-enc-banner-locked'] || styles.lumenPropertyEncBannerLocked)
                  }`}
                >
                  <div className={styles['lumen-property-enc-icon-wrap'] || styles.lumenPropertyEncIconWrap}>
                    {is_unlocked ? <ShieldCheck size={18} color="#16a34a" /> : <Lock size={18} color="#ef4444" />}
                  </div>
                  <div className={styles['lumen-property-enc-banner-text'] || styles.lumenPropertyEncBannerText}>
                    <span className={styles['lumen-property-enc-banner-title'] || styles.lumenPropertyEncBannerTitle}>
                      {is_unlocked ? 'Card Unlocked (Session Active)' : 'Card Encrypted & Locked'}
                    </span>
                    <span className={styles['lumen-property-enc-banner-desc'] || styles.lumenPropertyEncBannerDesc}>
                      {is_unlocked
                        ? 'Data is decrypted in this session. You can edit content or lock it again anytime.'
                        : 'Content is encrypted with AES-GCM 256. Enter passkey to unlock.'}
                    </span>
                  </div>
                </div>

                {/* Encryption Technical Specs */}
                <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
                  <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                    <span>Encryption Specifications</span>
                  </div>
                  <div className={styles['lumen-property-enc-spec-list'] || styles.lumenPropertyEncSpecList}>
                    <div className={styles['lumen-property-enc-spec-row'] || styles.lumenPropertyEncSpecRow}>
                      <span className={styles['lumen-property-enc-spec-label'] || styles.lumenPropertyEncSpecLabel}>Cipher:</span>
                      <span className={styles['lumen-property-enc-spec-val'] || styles.lumenPropertyEncSpecVal}>{enc_meta.algorithm || 'AES-GCM-256'}</span>
                    </div>
                    <div className={styles['lumen-property-enc-spec-row'] || styles.lumenPropertyEncSpecRow}>
                      <span className={styles['lumen-property-enc-spec-label'] || styles.lumenPropertyEncSpecLabel}>KDF:</span>
                      <span className={styles['lumen-property-enc-spec-val'] || styles.lumenPropertyEncSpecVal}>{enc_meta.kdf || 'PBKDF2-SHA256'}</span>
                    </div>
                    <div className={styles['lumen-property-enc-spec-row'] || styles.lumenPropertyEncSpecRow}>
                      <span className={styles['lumen-property-enc-spec-label'] || styles.lumenPropertyEncSpecLabel}>Iterations:</span>
                      <span className={styles['lumen-property-enc-spec-val'] || styles.lumenPropertyEncSpecVal}>{(enc_meta.iterations || 100000).toLocaleString()}</span>
                    </div>
                    {enc_meta.passkey_hint && (
                      <div className={styles['lumen-property-enc-spec-row'] || styles.lumenPropertyEncSpecRow}>
                        <span className={styles['lumen-property-enc-spec-label'] || styles.lumenPropertyEncSpecLabel}>Hint:</span>
                        <span style={{ fontWeight: 600, color: '#2563eb' }}>{enc_meta.passkey_hint}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* If Currently Locked: Unlock Form */}
                {!is_unlocked && (
                  <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
                    <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                      <span>Unlock Card</span>
                    </div>
                    <form onSubmit={handle_unlock_in_panel}>
                      <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                        <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                          <span>Enter Passkey</span>
                        </label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type={panel_unlock_show ? 'text' : 'password'}
                            value={panel_unlock_passkey}
                            onChange={(e) => {
                              set_panel_unlock_passkey(e.target.value);
                              if (panel_unlock_error) set_panel_unlock_error('');
                            }}
                            className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                            placeholder="Card passkey..."
                            style={{ paddingRight: 32 }}
                          />
                          <button
                            type="button"
                            onClick={() => set_panel_unlock_show(!panel_unlock_show)}
                            style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                            tabIndex={-1}
                          >
                            {panel_unlock_show ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                        {panel_unlock_error && (
                          <div className={styles['lumen-property-enc-error'] || styles.lumenPropertyEncError}>
                            {panel_unlock_error}
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="submit"
                          className={styles['lumen-property-enc-btn'] || styles.lumenPropertyEncBtn}
                          disabled={is_unlocking_in_panel || !panel_unlock_passkey}
                        >
                          <KeyRound size={13} />
                          <span>{is_unlocking_in_panel ? 'Decrypting...' : 'Unlock in Properties'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* If Currently Unlocked: Quick Actions, Change Passkey, Decrypt */}
                {is_unlocked && (
                  <>
                    <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
                      <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                        <span>Lock & Protection Controls</span>
                      </div>
                      <button
                        type="button"
                        className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                        onClick={() => lockCard(selected_card.id)}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        <Lock size={13} />
                        <span>Lock Card Now</span>
                      </button>
                    </div>

                    {/* Change Passkey Accordion */}
                    <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
                      <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                        <span>Passkey Management</span>
                      </div>
                      {!show_change_form ? (
                        <button
                          type="button"
                          className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                          onClick={() => set_show_change_form(true)}
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          <KeyRound size={13} />
                          <span>Change Card Passkey</span>
                        </button>
                      ) : (
                        <form onSubmit={handle_change_passkey_submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                            <div className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                              <span>New Passkey * (10+ chars, Mixed + Symbols)</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const strong = generate_strong_passkey(16);
                                  set_change_new_passkey(strong);
                                  set_change_confirm_passkey(strong);
                                  if (navigator.clipboard) navigator.clipboard.writeText(strong).catch(() => {});
                                  showToast('Generated & copied strong 16-char passkey');
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--lumen-accent, #2563eb)',
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                + Generate
                              </button>
                            </div>
                            <input
                              type="password"
                              value={change_new_passkey}
                              onChange={(e) => set_change_new_passkey(e.target.value)}
                              className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                              placeholder="e.g., K9#mQ2$vL8"
                            />
                            {/* Policy requirement live pills */}
                            {(() => {
                              const pol = validate_passkey_policy(change_new_passkey);
                              return (
                                <div className={styles['lumen-property-policy-box'] || styles.lumenPropertyPolicyBox} style={{ marginTop: 4 }}>
                                  <div className={styles['lumen-property-policy-row'] || styles.lumenPropertyPolicyRow}>
                                    <span style={{ fontWeight: 600 }}>Policy: 10 chars (Mixed + Symbols) (e.g., K9#mQ2$vL8)</span>
                                    <span style={{ fontWeight: 700, color: pol.is_valid ? '#10b981' : '#f97316' }}>
                                      {pol.passed_count}/5
                                    </span>
                                  </div>
                                  <div className={styles['lumen-property-policy-pills'] || styles.lumenPropertyPolicyPills}>
                                    <span className={`${styles['lumen-property-policy-pill'] || styles.lumenPropertyPolicyPill} ${pol.length ? (styles['lumen-property-policy-pill-valid'] || styles.lumenPropertyPolicyPillValid) : ''}`}>
                                      10+ Chars ({change_new_passkey.length}/10)
                                    </span>
                                    <span className={`${styles['lumen-property-policy-pill'] || styles.lumenPropertyPolicyPill} ${pol.upper ? (styles['lumen-property-policy-pill-valid'] || styles.lumenPropertyPolicyPillValid) : ''}`}>
                                      Uppercase
                                    </span>
                                    <span className={`${styles['lumen-property-policy-pill'] || styles.lumenPropertyPolicyPill} ${pol.lower ? (styles['lumen-property-policy-pill-valid'] || styles.lumenPropertyPolicyPillValid) : ''}`}>
                                      Lowercase
                                    </span>
                                    <span className={`${styles['lumen-property-policy-pill'] || styles.lumenPropertyPolicyPill} ${pol.number ? (styles['lumen-property-policy-pill-valid'] || styles.lumenPropertyPolicyPillValid) : ''}`}>
                                      Number
                                    </span>
                                    <span className={`${styles['lumen-property-policy-pill'] || styles.lumenPropertyPolicyPill} ${pol.symbol ? (styles['lumen-property-policy-pill-valid'] || styles.lumenPropertyPolicyPillValid) : ''}`}>
                                      Symbol
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                            <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                              <span>Confirm New Passkey *</span>
                              {change_confirm_passkey && (
                                <span style={{ fontSize: 10.5, fontWeight: 600, color: change_new_passkey === change_confirm_passkey ? '#10b981' : '#ef4444' }}>
                                  {change_new_passkey === change_confirm_passkey ? 'Matches' : 'Does not match'}
                                </span>
                              )}
                            </label>
                            <input
                              type="password"
                              value={change_confirm_passkey}
                              onChange={(e) => set_change_confirm_passkey(e.target.value)}
                              className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                              placeholder="e.g., K9#mQ2$vL8"
                            />
                          </div>
                          <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                            <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                              <span>New Hint (Optional)</span>
                            </label>
                            <input
                              type="text"
                              value={change_new_hint}
                              onChange={(e) => set_change_new_hint(e.target.value)}
                              className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                              placeholder="Optional new hint..."
                            />
                          </div>

                          {change_error_msg && (
                            <div className={styles['lumen-property-enc-error'] || styles.lumenPropertyEncError}>
                              {change_error_msg}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <button
                              type="submit"
                              className={styles['lumen-property-enc-btn'] || styles.lumenPropertyEncBtn}
                              disabled={is_changing_passkey || !change_new_passkey || !validate_passkey_policy(change_new_passkey).is_valid || change_new_passkey !== change_confirm_passkey}
                              style={{ flex: 1 }}
                            >
                              <span>{is_changing_passkey ? 'Saving...' : 'Update Passkey'}</span>
                            </button>
                            <button
                              type="button"
                              className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                              onClick={() => {
                                set_show_change_form(false);
                                set_change_error_msg('');
                              }}
                            >
                              <span>Cancel</span>
                            </button>
                          </div>
                        </form>
                      )}
                    </div>

                    {/* Decrypt Permanently back to normal card */}
                    <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
                      <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                        <span>Remove Encryption</span>
                      </div>
                      {!show_decrypt_confirm ? (
                        <button
                          type="button"
                          className={styles['lumen-property-danger-btn'] || styles.lumenPropertyDangerBtn}
                          onClick={() => set_show_decrypt_confirm(true)}
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          <Unlock size={13} />
                          <span>Decrypt to Normal Card</span>
                        </button>
                      ) : (
                        <div style={{ padding: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: '#991b1b', lineHeight: 1.4 }}>
                            Are you sure you want to remove encryption? Card contents will be stored as normal plain text.
                          </span>
                          {decrypt_error_msg && (
                            <span style={{ fontSize: 11, color: '#dc2626' }}>{decrypt_error_msg}</span>
                          )}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className={styles['lumen-property-danger-btn'] || styles.lumenPropertyDangerBtn}
                              onClick={handle_decrypt_permanently}
                              disabled={is_decrypting_permanently}
                              style={{ flex: 1 }}
                            >
                              <span>{is_decrypting_permanently ? 'Decrypting...' : 'Yes, Decrypt'}</span>
                            </button>
                            <button
                              type="button"
                              className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                              onClick={() => {
                                set_show_decrypt_confirm(false);
                                set_decrypt_error_msg('');
                              }}
                            >
                              <span>Cancel</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Tab 2: Style & Aesthetics */}
      {active_tab === 'style' && (
        <div className={styles['lumen-property-body'] || styles.lumenPropertyBody}>
          {/* Per-Card Style Mode (Inherits Board Panel Card Style or Overrides It) */}
          <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
            <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
              <span>Card Style Mode</span>
              <span className={styles['lumen-property-label-hint'] || styles.lumenPropertyLabelHint}>
                {selected_card.card_style === 'full' || selected_card.card_style === 'seamless'
                  ? `Override (${selected_card.card_style === 'seamless' ? 'Seamless' : 'Full'})`
                  : `Inherits Board (${(active_board?.board_setting?.card_style || 'full') === 'seamless' ? 'Seamless' : 'Full'})`}
              </span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 6 }}>
              {[
                {
                  id: 'board_default',
                  label: `Board (${(active_board?.board_setting?.card_style || 'full') === 'seamless' ? 'Seamless' : 'Full'})`,
                  hint: 'Follow the board-wide Card Style configured in Board Settings',
                },
                {
                  id: 'full',
                  label: 'Full',
                  hint: 'Override board setting and show full card frame, header, and toolbar',
                },
                {
                  id: 'seamless',
                  label: 'Seamless',
                  hint: 'Override board setting and show only card content with minimal border',
                },
              ].map((opt) => {
                const current_mode =
                  selected_card.card_style === 'full' || selected_card.card_style === 'seamless'
                    ? selected_card.card_style
                    : 'board_default';
                const is_active = current_mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      const next_style = opt.id === 'board_default' ? null : opt.id;
                      updateCard(selected_card.id, { card_style: next_style });
                      saveCurrentBoardToStore();
                      showToast(
                        opt.id === 'board_default'
                          ? 'Card style set to follow Board Default'
                          : `Card style overridden to ${opt.label}`
                      );
                    }}
                    title={opt.hint}
                    style={{
                      padding: '7px 8px',
                      fontSize: 11,
                      fontWeight: is_active ? 600 : 500,
                      borderRadius: 6,
                      border: is_active
                        ? '1px solid var(--lumen-accent, #2563eb)'
                        : '1px solid var(--lumen-border, #e2e8f0)',
                      backgroundColor: is_active
                        ? 'rgba(37, 99, 235, 0.08)'
                        : 'var(--lumen-surface, #ffffff)',
                      color: is_active
                        ? 'var(--lumen-accent, #2563eb)'
                        : 'var(--lumen-text-secondary, #475569)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <span
              className={styles['lumen-property-label-hint'] || styles.lumenPropertyLabelHint}
              style={{ marginTop: 4, display: 'block', lineHeight: 1.4 }}
            >
              Effective style:{' '}
              <strong>
                {resolve_card_style(selected_card, active_board) === 'seamless' ? 'Seamless' : 'Full'}
              </strong>
              . Individual card style overrides the Board Panel setting.
            </span>
          </div>

          {/* Free Commercial Google Fonts Browser & Picker */}
          <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
            <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Type size={13} color="var(--lumen-accent, #2563eb)" />
                <span>Google Fonts</span>
              </span>
            </label>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {[
                {
                  id: 'all',
                  label: `All (${(googleFontsCatalogSignal.value || FREE_COMMERCIAL_GOOGLE_FONTS).length})`,
                },
                { id: 'sans-serif', label: 'Sans' },
                { id: 'serif', label: 'Serif' },
                { id: 'display', label: 'Display' },
                { id: 'handwriting', label: 'Handwriting' },
                { id: 'monospace', label: 'Mono' },
              ].map((cat) => {
                const is_cat_active = font_category_filter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      set_font_category_filter(cat.id);
                      set_font_visible_limit(40);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: 10.5,
                      fontWeight: is_cat_active ? 600 : 500,
                      borderRadius: 5,
                      border: is_cat_active
                        ? '1px solid var(--lumen-accent, #2563eb)'
                        : '1px solid var(--lumen-border, #e2e8f0)',
                      backgroundColor: is_cat_active
                        ? 'rgba(37, 99, 235, 0.08)'
                        : 'var(--lumen-surface, #ffffff)',
                      color: is_cat_active
                        ? 'var(--lumen-accent, #2563eb)'
                        : 'var(--lumen-text-secondary, #475569)',
                      cursor: 'pointer',
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Search or Load Any Custom Google Font Family */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                <Search
                  size={12}
                  color="var(--lumen-text-muted, #64748b)"
                  style={{ position: 'absolute', left: 9, pointerEvents: 'none' }}
                />
                <input
                  type="text"
                  value={font_search_query}
                  onChange={(e) => {
                    set_font_search_query(e.target.value);
                    set_custom_google_font_input(e.target.value);
                    set_font_visible_limit(40);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && custom_google_font_input.trim()) {
                      const matches = search_google_fonts(custom_google_font_input.trim(), font_category_filter);
                      const fam = matches.length > 0 ? matches[0].family : custom_google_font_input.trim();
                      load_google_font(fam);
                      updateCard(selected_card.id, { font_family: fam });
                      saveCurrentBoardToStore();
                      showToast(`Selected Google Font "${fam}"`);
                    }
                  }}
                  placeholder={`Search ${(googleFontsCatalogSignal.value || FREE_COMMERCIAL_GOOGLE_FONTS).length}+ free commercial fonts...`}
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                  style={{ width: '100%', paddingLeft: 26, paddingRight: font_search_query ? 24 : 8, fontSize: 11.5 }}
                />
                {font_search_query && (
                  <button
                    type="button"
                    onClick={() => {
                      set_font_search_query('');
                      set_custom_google_font_input('');
                      set_font_visible_limit(40);
                    }}
                    style={{
                      position: 'absolute',
                      right: 6,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--lumen-text-muted, #64748b)',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              {custom_google_font_input.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    const fam = custom_google_font_input.trim();
                    load_google_font(fam);
                    updateCard(selected_card.id, { font_family: fam });
                    saveCurrentBoardToStore();
                    showToast(`Loaded Google Font "${fam}"`);
                  }}
                  className={styles['lumen-property-add-btn'] || styles.lumenPropertyAddBtn}
                  style={{ padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
                  title="Load this font family directly from Google Fonts"
                >
                  Apply Font
                </button>
              )}
            </div>

            {/* Dropdown Selector for All Free Commercial Google Fonts */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <select
                value={selected_card.font_family || selected_card.doc_font || 'board_default'}
                onChange={(e) => {
                  const val = e.target.value;
                  const next_font = val === 'board_default' ? null : val;
                  if (next_font) load_google_font(next_font);
                  updateCard(selected_card.id, {
                    font_family: next_font,
                    ...(selected_card.type === 'docs' ? { doc_font: next_font || 'Inter' } : {}),
                  });
                  saveCurrentBoardToStore();
                  showToast(
                    next_font
                      ? `Content font set to "${next_font}" (Free Commercial Google Font)`
                      : 'Content font set to follow Board Default'
                  );
                }}
                className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                style={{
                  flex: 1,
                  fontWeight: 500,
                  fontFamily:
                    resolve_card_font_family(selected_card, active_board) || 'inherit',
                }}
              >
                <option value="board_default">
                  Board Default ({active_board?.board_setting?.font_family || 'Inter'})
                </option>
                {(['sans-serif', 'serif', 'display', 'handwriting', 'monospace']
                  .filter((cat_key) => font_category_filter === 'all' || font_category_filter === cat_key)
                ).map((cat_key) => {
                  const cat_label =
                    cat_key === 'sans-serif'
                      ? 'Sans-Serif (SIL OFL / Apache 2.0)'
                      : cat_key === 'serif'
                      ? 'Serif (SIL OFL 1.1)'
                      : cat_key === 'display'
                      ? 'Display & Headline (SIL OFL 1.1)'
                      : cat_key === 'handwriting'
                      ? 'Handwriting & Script (OFL / Apache)'
                      : 'Monospace (SIL OFL 1.1)';
                  const cat_fonts = (googleFontsCatalogSignal.value || FREE_COMMERCIAL_GOOGLE_FONTS).filter(
                    (f) => f.category === cat_key
                  );
                  return (
                    <optgroup key={cat_key} label={`${cat_label} (${cat_fonts.length})`}>
                      {cat_fonts.map((f) => (
                        <option key={f.family} value={f.family}>
                          {f.family}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
                {selected_card.font_family &&
                  selected_card.font_family !== 'board_default' &&
                  !(googleFontsCatalogSignal.value || FREE_COMMERCIAL_GOOGLE_FONTS).some(
                    (f) => f.family.toLowerCase() === selected_card.font_family.toLowerCase()
                  ) && (
                    <optgroup label="Custom Google Font">
                      <option value={selected_card.font_family}>
                        {selected_card.font_family} (Custom)
                      </option>
                    </optgroup>
                  )}
              </select>
            </div>

            {/* Scrollable Live Font Specimen List */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                maxHeight: 260,
                overflowY: 'auto',
                paddingRight: 2,
              }}
            >
              {/* Board Default Option */}
              <button
                type="button"
                onClick={() => {
                  updateCard(selected_card.id, { font_family: null });
                  saveCurrentBoardToStore();
                  showToast('Card font reset to follow Board Default');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: 7,
                  border:
                    !selected_card.font_family || selected_card.font_family === 'board_default'
                      ? '1.5px solid var(--lumen-accent, #2563eb)'
                      : '1px solid var(--lumen-border, #e2e8f0)',
                  backgroundColor:
                    !selected_card.font_family || selected_card.font_family === 'board_default'
                      ? 'rgba(37, 99, 235, 0.06)'
                      : 'var(--lumen-surface, #ffffff)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--lumen-text-primary, #0f172a)' }}>
                    Inherit Board Default ({active_board?.board_setting?.font_family || 'Inter'})
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--lumen-text-muted, #64748b)' }}>
                    Follows the board-wide Google Font in Board Settings
                  </div>
                </div>
                {(!selected_card.font_family || selected_card.font_family === 'board_default') && (
                  <Check size={13} color="var(--lumen-accent, #2563eb)" />
                )}
              </button>

              {(() => {
                const filtered_fonts = search_google_fonts(font_search_query, font_category_filter);
                const visible_fonts = filtered_fonts.slice(0, font_visible_limit);
                return (
                  <>
                    {visible_fonts.map((gf) => {
                      load_google_font(gf.family);
                      const is_selected_font =
                        selected_card.font_family &&
                        selected_card.font_family.toLowerCase() === gf.family.toLowerCase();
                      const preview_stack = get_google_font_css_stack(gf.family);
                      return (
                        <button
                          key={gf.family}
                          type="button"
                          onClick={() => {
                            load_google_font(gf.family);
                            updateCard(selected_card.id, { font_family: gf.family });
                            saveCurrentBoardToStore();
                            showToast(`Selected Google Font: ${gf.family} (${gf.license})`);
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            padding: '8px 10px',
                            borderRadius: 7,
                            border: is_selected_font
                              ? '1.5px solid var(--lumen-accent, #2563eb)'
                              : '1px solid var(--lumen-border, #e2e8f0)',
                            backgroundColor: is_selected_font
                              ? 'rgba(37, 99, 235, 0.06)'
                              : 'var(--lumen-surface, #ffffff)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                fontFamily: preview_stack || 'inherit',
                                color: is_selected_font
                                  ? 'var(--lumen-accent, #2563eb)'
                                  : 'var(--lumen-text-primary, #0f172a)',
                              }}
                            >
                              {gf.family}
                            </span>
                            <span
                              style={{
                                fontSize: 9.5,
                                color: 'var(--lumen-text-muted, #64748b)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                                fontWeight: 600,
                              }}
                            >
                              {gf.category} • OFL
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontFamily: preview_stack || 'inherit',
                              color: 'var(--lumen-text-secondary, #475569)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              width: '100%',
                            }}
                          >
                            {gf.sample}
                          </span>
                        </button>
                      );
                    })}
                    {filtered_fonts.length > font_visible_limit && (
                      <button
                        type="button"
                        onClick={() => set_font_visible_limit((prev) => prev + 50)}
                        style={{
                          padding: '7px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 6,
                          border: '1px dashed var(--lumen-border, #cbd5e1)',
                          backgroundColor: 'var(--lumen-surface-subtle, #f8fafc)',
                          color: 'var(--lumen-accent, #2563eb)',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        Show More Free Commercial Fonts ({filtered_fonts.length - font_visible_limit} more matching)
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Color Presets */}
          <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
            <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
              <span>Color Theme Presets</span>
              <span className={styles['lumen-property-label-hint'] || styles.lumenPropertyLabelHint}>
                {selected_card.color || 'white'}
              </span>
            </label>
            <div className={styles['lumen-color-palette'] || styles.lumenColorPalette}>
              {COLOR_PRESETS.map((p) => (
                <div
                  key={p.name}
                  className={`${styles['lumen-color-swatch'] || styles.lumenColorSwatch} ${
                    selected_card.color === p.name
                      ? (styles['lumen-color-swatch-active'] || styles.lumenColorSwatchActive)
                      : ''
                  }`}
                  style={{ backgroundColor: p.hex }}
                  onClick={() => handle_color_change(p.name)}
                  title={p.label}
                />
              ))}
            </div>
          </div>

          {/* Custom Background Color */}
          <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
            <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
              <span>Custom Background Color</span>
              {selected_card.bg_color && (
                <button
                  type="button"
                  style={{
                    border: 'none',
                    background: 'none',
                    color: 'var(--lumen-accent, #2563eb)',
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                  onClick={() => updateCard(selected_card.id, { bg_color: null })}
                >
                  Reset
                </button>
              )}
            </label>
            <div className={styles['lumen-property-color-picker-row'] || styles.lumenPropertyColorPickerRow}>
              <input
                type="color"
                value={selected_card.bg_color || '#ffffff'}
                onChange={handle_custom_bg_change}
                className={styles['lumen-property-color-input'] || styles.lumenPropertyColorInput}
              />
              <input
                type="text"
                value={selected_card.bg_color || ''}
                onChange={handle_custom_bg_change}
                placeholder="e.g. #ffffff or rgba(...)"
                className={styles['lumen-property-hex-input'] || styles.lumenPropertyHexInput}
              />
            </div>
          </div>

          {/* Custom Text Color */}
          <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
            <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
              <span>Custom Text Color</span>
              {selected_card.text_color && (
                <button
                  type="button"
                  style={{
                    border: 'none',
                    background: 'none',
                    color: 'var(--lumen-accent, #2563eb)',
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                  onClick={() => updateCard(selected_card.id, { text_color: null })}
                >
                  Reset
                </button>
              )}
            </label>
            <div className={styles['lumen-property-color-picker-row'] || styles.lumenPropertyColorPickerRow}>
              <input
                type="color"
                value={selected_card.text_color || '#0f172a'}
                onChange={handle_custom_text_color_change}
                className={styles['lumen-property-color-input'] || styles.lumenPropertyColorInput}
              />
              <input
                type="text"
                value={selected_card.text_color || ''}
                onChange={handle_custom_text_color_change}
                placeholder="e.g. #0f172a"
                className={styles['lumen-property-hex-input'] || styles.lumenPropertyHexInput}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Layout & Geometry */}
      {active_tab === 'layout' && (
        <div className={styles['lumen-property-body'] || styles.lumenPropertyBody}>
          {/* Dimensions */}
          <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <span>Dimensions (px)</span>
            </div>
            <div className={styles['lumen-property-row'] || styles.lumenPropertyRow}>
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Width</span>
                </label>
                <input
                  type="number"
                  value={width_input}
                  onChange={handle_width_change}
                  onBlur={handle_width_blur}
                  placeholder="Width"
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                />
              </div>
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Height</span>
                </label>
                <input
                  type="number"
                  value={height_input}
                  onChange={handle_height_change}
                  onBlur={handle_height_blur}
                  placeholder="Height"
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                />
              </div>
            </div>
          </div>

          {/* Coordinates */}
          <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <span>Canvas Position (px)</span>
            </div>
            <div className={styles['lumen-property-row'] || styles.lumenPropertyRow}>
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>X Coordinate</span>
                </label>
                <input
                  type="number"
                  value={selected_card.x || 0}
                  onChange={handle_x_change}
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                />
              </div>
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Y Coordinate</span>
                </label>
                <input
                  type="number"
                  value={selected_card.y || 0}
                  onChange={handle_y_change}
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                />
              </div>
            </div>
          </div>

          {/* Layer Order & Z-Index */}
          <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <span>Layer Stacking (Z-Index)</span>
            </div>
            <div className={styles['lumen-property-row'] || styles.lumenPropertyRow}>
              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Stack Order</span>
                </label>
                <input
                  type="number"
                  value={selected_card.zIndex || 1}
                  onChange={handle_z_index_change}
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                    onClick={() => bringToFront(selected_card.id)}
                    style={{ flex: 1, padding: '4px 6px', fontSize: 11 }}
                    title="Bring to Front"
                  >
                    To Front
                  </button>
                  <button
                    type="button"
                    className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                    onClick={() => sendToBack(selected_card.id)}
                    style={{ flex: 1, padding: '4px 6px', fontSize: 11 }}
                    title="Send to Back"
                  >
                    To Back
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card Protection & State Toggles */}
          <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <span>Card State & Protection</span>
            </div>

            <div className={styles['lumen-property-switch-row'] || styles.lumenPropertySwitchRow}>
              <div className={styles['lumen-property-switch-label'] || styles.lumenPropertySwitchLabel}>
                {selected_card.locked ? <Lock size={13} color="#ef4444" /> : <Unlock size={13} />}
                <span>Lock Card (Prevent move/edit)</span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(selected_card.locked)}
                onChange={handle_toggle_locked}
                style={{ cursor: 'pointer' }}
              />
            </div>

            <div className={styles['lumen-property-switch-row'] || styles.lumenPropertySwitchRow}>
              <div className={styles['lumen-property-switch-label'] || styles.lumenPropertySwitchLabel}>
                {selected_card.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>Hide / Dim Card on Board</span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(selected_card.hidden)}
                onChange={handle_toggle_hidden}
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Labels & Info */}
      {active_tab === 'tags' && (
        <div className={styles['lumen-property-body'] || styles.lumenPropertyBody}>
          {/* Card Tags / Labels */}
          <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <span>Card Labels & Tags</span>
            </div>

            <div className={styles['lumen-property-tags-wrap'] || styles.lumenPropertyTagsWrap}>
              {(selected_card.tags || []).length === 0 && (
                <span style={{ fontSize: 11.5, color: 'var(--lumen-text-muted, #94a3b8)' }}>
                  No labels assigned yet.
                </span>
              )}
              {(selected_card.tags || []).map((t, idx) => {
                const tag_text = typeof t === 'string' ? t : t.text;
                const tag_color = typeof t === 'object' && t.color ? t.color : '#2563eb';
                return (
                  <span
                    key={idx}
                    className={styles['lumen-property-tag-chip'] || styles.lumenPropertyTagChip}
                    style={{
                      backgroundColor: `${tag_color}18`,
                      borderColor: `${tag_color}40`,
                      color: tag_color,
                    }}
                  >
                    <span>{tag_text}</span>
                    <button
                      type="button"
                      className={styles['lumen-property-tag-delete'] || styles.lumenPropertyTagDelete}
                      onClick={() => handle_remove_tag(idx)}
                      style={{ border: 'none', background: 'none', padding: 0, color: 'inherit' }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                );
              })}
            </div>

            {/* Quick suggested tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {SUGGESTED_TAGS.map((st) => (
                <button
                  key={st.text}
                  type="button"
                  onClick={() => {
                    const existing = selected_card.tags || [];
                    const already = existing.some(
                      (t) => (typeof t === 'string' ? t : t.text).toLowerCase() === st.text.toLowerCase()
                    );
                    if (!already) {
                      updateCard(selected_card.id, { tags: [...existing, st] });
                    }
                  }}
                  style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 4,
                    border: '1px dashed var(--lumen-border, #cbd5e1)',
                    background: 'var(--lumen-canvas-bg, #f8fafc)',
                    color: 'var(--lumen-text-secondary, #64748b)',
                    cursor: 'pointer',
                  }}
                >
                  + {st.text}
                </button>
              ))}
            </div>

            {/* Add custom tag */}
            <div className={styles['lumen-property-add-inline'] || styles.lumenPropertyAddInline} style={{ marginTop: 6 }}>
              <input
                type="text"
                value={new_tag_text}
                onChange={(e) => set_new_tag_text(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handle_add_tag();
                }}
                className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                placeholder="New tag label..."
              />
              <input
                type="color"
                value={new_tag_color}
                onChange={(e) => set_new_tag_color(e.target.value)}
                style={{
                  width: 30,
                  height: 30,
                  padding: 0,
                  border: '1px solid var(--lumen-border, #cbd5e1)',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                title="Tag color"
              />
              <button
                type="button"
                className={styles['lumen-property-add-btn'] || styles.lumenPropertyAddBtn}
                onClick={handle_add_tag}
              >
                <Plus size={13} />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Time Range & Google Calendar Sync */}
          <LUMEN_card_time_range_section selected_card={selected_card} />

          {/* Author & Metadata */}
          <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <span>Card Metadata</span>
            </div>
            <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
              <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                <span>Author / Creator</span>
              </label>
              <input
                type="text"
                value={selected_card.author || ''}
                onChange={(e) => updateCard(selected_card.id, { author: e.target.value })}
                className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                placeholder="Name or handle..."
              />
            </div>
          </div>

          {/* Collaboration Comments */}
          <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <span>Team Collaboration</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                onClick={() => openCardCommentsDrawer(selected_card.id)}
              >
                <MessageSquare size={13} />
                <span>Team Discussion & Comments</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: AI Features & Actions */}
      {active_tab === 'ai' && (
        <div className={styles['lumen-property-body'] || styles.lumenPropertyBody}>
          {selected_card.type === 'sound_recorder' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} color="#4f46e5" />
                  <span style={{ fontWeight: 600 }}>AI Transcribe & Translate</span>
                </div>
                {Boolean(isCardAiProcessingSignal.value) && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#4f46e5' }}>Processing...</span>
                )}
              </div>

              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Languages size={12} color="var(--lumen-accent, #2563eb)" />
                    <span>Target Translation Language</span>
                  </span>
                </label>
                <select
                  value={selected_card.target_language || 'English'}
                  onChange={(e) => updateCard(selected_card.id, { target_language: e.target.value }, true)}
                  className={styles['lumen-property-input'] || styles.lumenPropertyInput}
                >
                  {SOUND_TRANSLATE_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>AI Audio Actions</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button
                    type="button"
                    disabled={Boolean(isCardAiProcessingSignal.value)}
                    className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                    onClick={() => runAiCardAction(selected_card.id, 'sound_transcribe', '')}
                    style={{ fontSize: 11, padding: '6px 8px', justifyContent: 'center' }}
                  >
                    <FileText size={12} />
                    <span>Transcribe Audio</span>
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(isCardAiProcessingSignal.value)}
                    className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                    onClick={() =>
                      runAiCardAction(
                        selected_card.id,
                        'sound_translate',
                        selected_card.target_language || 'English'
                      )
                    }
                    style={{ fontSize: 11, padding: '6px 8px', justifyContent: 'center' }}
                  >
                    <Languages size={12} />
                    <span>Translate ({selected_card.target_language || 'English'})</span>
                  </button>
                </div>
                <button
                  type="button"
                  disabled={Boolean(isCardAiProcessingSignal.value)}
                  className={styles['lumen-property-add-btn'] || styles.lumenPropertyAddBtn}
                  onClick={() =>
                    runAiCardAction(
                      selected_card.id,
                      'sound_transcribe_and_translate',
                      selected_card.target_language || 'English'
                    )
                  }
                  style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}
                >
                  <Sparkles size={12} />
                  <span>Transcribe & Translate to {selected_card.target_language || 'English'}</span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(isCardAiProcessingSignal.value)}
                  className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                  onClick={() => runAiCardAction(selected_card.id, 'sound_to_note_card', '')}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 6, fontSize: 11 }}
                >
                  <FileText size={12} />
                  <span>Create Note Card from Recording</span>
                </button>
              </div>

              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Transcript {selected_card.detected_language ? `(${selected_card.detected_language})` : ''}</span>
                </label>
                <textarea
                  rows={3}
                  value={selected_card.transcript || ''}
                  onChange={(e) =>
                    updateCard(selected_card.id, { transcript: e.target.value, content: e.target.value }, false)
                  }
                  placeholder="Audio transcription..."
                  className={styles['lumen-property-textarea'] || styles.lumenPropertyTextarea}
                />
              </div>

              <div className={styles['lumen-property-field'] || styles.lumenPropertyField}>
                <label className={styles['lumen-property-label'] || styles.lumenPropertyLabel}>
                  <span>Translation ({selected_card.target_language || 'English'})</span>
                </label>
                <textarea
                  rows={3}
                  value={selected_card.translated_text || ''}
                  onChange={(e) =>
                    updateCard(selected_card.id, { translated_text: e.target.value }, false)
                  }
                  placeholder="Translated text..."
                  className={styles['lumen-property-textarea'] || styles.lumenPropertyTextarea}
                />
              </div>
            </div>
          )}

          {selected_card.type !== 'sound_recorder' && (
            <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
              <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} color="#4f46e5" />
                  <span style={{ fontWeight: 600 }}>Card AI Actions</span>
                </div>
                {Boolean(isCardAiProcessingSignal.value) && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#4f46e5' }}>Processing...</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {getCardAiActions(selected_card.type).map((action) => {
                  const needs_prompt_popup =
                    action.id === 'image_create_image' ||
                    action.id === 'image_visualize_creatively' ||
                    action.id === 'note_create_image' ||
                    action.id === 'note_creative_spark' ||
                    action.id === 'note_replace_content' ||
                    action.id === 'note_text_to_voice' ||
                    action.id === 'code_generate_snippet' ||
                    action.id === 'code_improve_current';
                  const is_active_popup = panel_ai_popup_action === action.id;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      disabled={Boolean(isCardAiProcessingSignal.value)}
                      className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
                      onClick={() => {
                        if (needs_prompt_popup) {
                          set_panel_ai_popup_action(is_active_popup ? null : action.id);
                          const has_existing_img = Boolean(
                            (Array.isArray(selected_card.images) && selected_card.images.length > 0) ||
                              selected_card.imageUrl
                          );
                          set_panel_ai_prompt_input(
                            action.id === 'code_generate_snippet' ||
                              action.id === 'code_improve_current' ||
                              (action.id === 'image_create_image' &&
                                panel_use_ref_image &&
                                has_existing_img)
                              ? ''
                              : selected_card.ai_prompt || selected_card.title || ''
                          );
                        } else {
                          set_panel_ai_popup_action(null);
                          runAiCardAction(selected_card.id, action.id, '');
                        }
                      }}
                      style={{
                        justifyContent: 'space-between',
                        fontSize: 11.5,
                        padding: '7px 10px',
                        borderColor: is_active_popup ? 'rgba(79, 70, 229, 0.45)' : undefined,
                        background: is_active_popup ? 'rgba(79, 70, 229, 0.06)' : undefined,
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {action.id === 'note_text_to_voice' ? (
                          <Volume2 size={12} color="#7c3aed" />
                        ) : action.id === 'code_generate_snippet' ? (
                          <FileCode size={12} color="#4f46e5" />
                        ) : (
                          <Sparkles size={12} color="#4f46e5" />
                        )}
                        <span>{action.label}</span>
                      </span>
                      {needs_prompt_popup && (
                        <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>
                          {action.id === 'note_text_to_voice' ? 'Voice & Lang' : 'Prompt'}
                        </span>
                      )}
                    </button>
                  );
                })}

                {panel_ai_popup_action &&
                  (() => {
                    const is_img_cmd =
                      panel_ai_popup_action === 'image_create_image' ||
                      panel_ai_popup_action === 'note_create_image';
                    const is_tts_cmd = panel_ai_popup_action === 'note_text_to_voice';
                    const is_code_cmd = panel_ai_popup_action === 'code_generate_snippet';
                    const task_cat = resolveAiTaskCategoryForAction(
                      panel_ai_popup_action,
                      selected_card.type
                    );
                    const selected_board_model = getSelectedAiModelForTask(task_cat);
                    return (
                      <div
                        style={{
                          marginTop: 4,
                          padding: 10,
                          borderRadius: 10,
                          border: '1px solid rgba(79, 70, 229, 0.28)',
                          background: 'rgba(79, 70, 229, 0.04)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 6,
                          }}
                        >
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5' }}>
                            {is_tts_cmd
                              ? 'Google Text-to-Speech Settings'
                              : is_img_cmd
                              ? 'Create Image Prompt'
                              : is_code_cmd
                              ? 'Generate Code Snippet Prompt'
                              : 'Replace Content Prompt'}
                          </span>
                          <button
                            type="button"
                            onClick={() => set_panel_ai_popup_action(null)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#64748b',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'inline-flex',
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {is_tts_cmd ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>
                                Google TTS Voice
                              </span>
                              <select
                                value={panel_tts_voice}
                                onChange={(e) => set_panel_tts_voice(e.target.value)}
                                className={
                                  styles['lumen-property-select'] || styles.lumenPropertySelect
                                }
                                style={{ fontSize: 11, padding: '4px 6px' }}
                              >
                                {MUSE_VOICE_PERSONA_CATEGORIES.map((cat) => (
                                  <optgroup key={cat} label={cat}>
                                    {MUSE_VOICE_PERSONA_OPTIONS.filter(
                                      (vo) => vo.category === cat
                                    ).map((vo) => (
                                      <option key={vo.id} value={vo.id}>
                                        {vo.label}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>
                                Language
                              </span>
                              <select
                                value={panel_tts_lang}
                                onChange={(e) => set_panel_tts_lang(e.target.value)}
                                className={
                                  styles['lumen-property-select'] || styles.lumenPropertySelect
                                }
                                style={{ fontSize: 11, padding: '4px 6px' }}
                              >
                                {MUSE_VOICE_LANGUAGE_OPTIONS.map((lang) => (
                                  <option key={lang} value={lang}>
                                    {lang}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '4px 8px',
                                borderRadius: 6,
                                background: 'rgba(79, 70, 229, 0.08)',
                                fontSize: 10,
                                color: '#4338ca',
                              }}
                            >
                              <span style={{ opacity: 0.85 }}>Board List Model:</span>
                              <strong style={{ fontWeight: 700 }}>
                                {selected_board_model?.full_name ||
                                  selected_board_model?.name ||
                                  'Gemini 3.1 Flash Image'}
                              </strong>
                            </div>

                            {panel_ai_popup_action === 'image_create_image' && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 6,
                                  padding: '7px 8px',
                                  borderRadius: 7,
                                  background: 'var(--lumen-surface, #ffffff)',
                                  border: '1px solid var(--lumen-border, #e2e8f0)',
                                }}
                              >
                                {slides.length > 0 && slides[active_slide_idx]?.url && (
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 4,
                                      paddingBottom: 6,
                                      borderBottom: '1px dashed var(--lumen-border, #e2e8f0)',
                                    }}
                                  >
                                    <label
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: 'var(--lumen-text-primary, #0f172a)',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={panel_use_ref_image}
                                        onChange={(e) => set_panel_use_ref_image(e.target.checked)}
                                        style={{ accentColor: '#7c3aed', cursor: 'pointer' }}
                                      />
                                      <span>
                                        Use current active image as reference (Slide #{active_slide_idx + 1})
                                      </span>
                                    </label>
                                    {panel_use_ref_image && (
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: 6,
                                          fontSize: 10.5,
                                        }}
                                      >
                                        <span style={{ color: '#5b21b6', fontWeight: 600 }}>
                                          Strength: {panel_ref_strength.toFixed(2)}
                                        </span>
                                        <input
                                          type="range"
                                          min="0.30"
                                          max="0.90"
                                          step="0.05"
                                          value={panel_ref_strength}
                                          onChange={(e) => set_panel_ref_strength(Number(e.target.value))}
                                          style={{ flex: 1, accentColor: '#7c3aed', cursor: 'pointer' }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                    gap: 6,
                                  }}
                                >
                                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 9.5, fontWeight: 600, color: '#475569' }}>
                                      Size
                                    </span>
                                    <select
                                      value={panel_ai_image_size}
                                      onChange={(e) => set_panel_ai_image_size(e.target.value)}
                                      className={
                                        styles['lumen-property-select'] || styles.lumenPropertySelect
                                      }
                                      style={{ fontSize: 10.5, padding: '3px 5px', fontWeight: 600 }}
                                    >
                                      <option value="auto">auto</option>
                                      <option value="1024x1024">1024x1024</option>
                                      <option value="1024x1536">1024x1536</option>
                                      <option value="1536x1024">1536x1024</option>
                                    </select>
                                  </label>

                                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 9.5, fontWeight: 600, color: '#475569' }}>
                                      Format
                                    </span>
                                    <select
                                      value={panel_ai_output_format}
                                      onChange={(e) => set_panel_ai_output_format(e.target.value)}
                                      className={
                                        styles['lumen-property-select'] || styles.lumenPropertySelect
                                      }
                                      style={{ fontSize: 10.5, padding: '3px 5px', fontWeight: 600 }}
                                    >
                                      <option value="jpg">jpg (default)</option>
                                      <option value="png">png</option>
                                      <option value="webp">webp</option>
                                    </select>
                                  </label>

                                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 9.5, fontWeight: 600, color: '#475569' }}>
                                      Reasoning
                                    </span>
                                    <select
                                      value={panel_ai_reasoning_strength}
                                      onChange={(e) => set_panel_ai_reasoning_strength(e.target.value)}
                                      className={
                                        styles['lumen-property-select'] || styles.lumenPropertySelect
                                      }
                                      style={{ fontSize: 10.5, padding: '3px 5px', fontWeight: 600 }}
                                    >
                                      <option value="high">high</option>
                                      <option value="low">low</option>
                                    </select>
                                  </label>
                                </div>

                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 4,
                                    paddingTop: 4,
                                    borderTop: '1px dashed var(--lumen-border, #e2e8f0)',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  {[
                                    {
                                      label: 'Image Search',
                                      checked: panel_ai_image_search,
                                      setter: set_panel_ai_image_search,
                                    },
                                    {
                                      label: 'Web Search',
                                      checked: panel_ai_web_search,
                                      setter: set_panel_ai_web_search,
                                    },
                                    {
                                      label: 'Shell',
                                      checked: panel_ai_shell,
                                      setter: set_panel_ai_shell,
                                    },
                                    {
                                      label: '✨ Auto-Improve Prompt (Muse Wonder)',
                                      checked: panel_ai_auto_improve_prompt,
                                      setter: set_panel_ai_auto_improve_prompt,
                                    },
                                  ].map((tool_item) => (
                                    <label
                                      key={tool_item.label}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        fontSize: 9.5,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        background: tool_item.checked
                                          ? 'rgba(124, 58, 237, 0.1)'
                                          : 'var(--lumen-canvas-bg, #f8fafc)',
                                        border: `1px solid ${
                                          tool_item.checked
                                            ? 'rgba(124, 58, 237, 0.4)'
                                            : 'var(--lumen-border, #cbd5e1)'
                                        }`,
                                        color: tool_item.checked ? '#5b21b6' : '#475569',
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={tool_item.checked}
                                        onChange={(e) => tool_item.setter(e.target.checked)}
                                        style={{ width: 11, height: 11, accentColor: '#7c3aed', margin: 0 }}
                                      />
                                      <span>
                                        {tool_item.label}: {tool_item.checked ? 'on' : 'off'}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            <textarea
                              rows={3}
                              value={panel_ai_prompt_input}
                              onChange={(e) => set_panel_ai_prompt_input(e.target.value)}
                              placeholder={
                                is_img_cmd
                                  ? 'Describe the image to generate...'
                                  : is_code_cmd
                                  ? 'Describe the code snippet or function to generate...'
                                  : 'Describe the content to write...'
                              }
                              className={
                                styles['lumen-property-textarea'] || styles.lumenPropertyTextarea
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                  e.preventDefault();
                                  const trimmed_val =
                                    panel_ai_prompt_input.trim() ||
                                    selected_card.title ||
                                    (is_code_cmd ? 'Write a utility helper function' : 'Studio Product Photography');
                                  const act_id = panel_ai_popup_action;
                                  set_panel_ai_popup_action(null);
                                  runAiCardAction(
                                    selected_card.id,
                                    act_id,
                                    trimmed_val,
                                    act_id === 'image_create_image'
                                      ? {
                                          ...(panel_use_ref_image && slides[active_slide_idx]?.url
                                            ? {
                                                use_reference_image: true,
                                                reference_strength: panel_ref_strength,
                                                active_slide_index: active_slide_idx,
                                                reference_image_url: slides[active_slide_idx]?.url,
                                                reference_file_id: slides[active_slide_idx]?.file_id || null,
                                              }
                                            : {}),
                                          image_size: panel_ai_image_size,
                                          output_format: panel_ai_output_format,
                                          reasoning_strength: panel_ai_reasoning_strength,
                                          enable_image_search: panel_ai_image_search,
                                          enable_web_search: panel_ai_web_search,
                                          enable_shell: panel_ai_shell,
                                          auto_improve_prompt: panel_ai_auto_improve_prompt,
                                        }
                                      : {}
                                  );
                                }
                              }}
                            />
                          </>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                          {panel_ai_popup_action === 'image_create_image' && (
                            <button
                              type="button"
                              disabled={
                                Boolean(isCardAiProcessingSignal.value) ||
                                is_panel_improving_prompt
                              }
                              className={
                                styles['lumen-property-btn-secondary'] ||
                                styles.lumenPropertyBtnSecondary
                              }
                              onClick={async () => {
                                if (is_panel_improving_prompt) return;
                                set_is_panel_improving_prompt(true);
                                try {
                                  const res = await improveImagePromptWithMuse(
                                    selected_card.id,
                                    panel_ai_prompt_input.trim(),
                                    {
                                      use_reference_image: Boolean(
                                        panel_use_ref_image && slides[active_slide_idx]?.url
                                      ),
                                      active_slide_index: active_slide_idx,
                                    }
                                  );
                                  if (res?.improvedPrompt) {
                                    set_panel_ai_prompt_input(res.improvedPrompt);
                                  }
                                } finally {
                                  set_is_panel_improving_prompt(false);
                                }
                              }}
                              style={{ padding: '5px 10px', fontSize: 11 }}
                              title="Rewrite and improve your image prompt right now using muse-wonder-1.0"
                            >
                              {is_panel_improving_prompt
                                ? 'Improving...'
                                : '✨ Improve Prompt (Muse Wonder)'}
                            </button>
                          )}
                          <button
                            type="button"
                            className={
                              styles['lumen-property-btn-secondary'] ||
                              styles.lumenPropertyBtnSecondary
                            }
                            onClick={() => set_panel_ai_popup_action(null)}
                            style={{ padding: '5px 10px', fontSize: 11 }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(isCardAiProcessingSignal.value)}
                            className={
                              styles['lumen-property-ai-btn'] || styles.lumenPropertyAiBtn
                            }
                            onClick={() => {
                              const act_id = panel_ai_popup_action;
                              set_panel_ai_popup_action(null);
                              if (is_tts_cmd) {
                                updateCard(
                                  selected_card.id,
                                  {
                                    tts_voice_persona: panel_tts_voice,
                                    tts_language: panel_tts_lang,
                                  },
                                  true
                                );
                                runAiCardAction(
                                  selected_card.id,
                                  act_id,
                                  `[voice:${panel_tts_voice}][lang:${panel_tts_lang}]`
                                );
                              } else {
                                const trimmed_val =
                                  panel_ai_prompt_input.trim() ||
                                  selected_card.title ||
                                  (is_code_cmd ? 'Write a utility helper function' : 'Studio Product Photography');
                                runAiCardAction(
                                  selected_card.id,
                                  act_id,
                                  trimmed_val,
                                  act_id === 'image_create_image'
                                    ? {
                                        ...(panel_use_ref_image && slides[active_slide_idx]?.url
                                          ? {
                                              use_reference_image: true,
                                              reference_strength: panel_ref_strength,
                                              active_slide_index: active_slide_idx,
                                              reference_image_url: slides[active_slide_idx]?.url,
                                              reference_file_id: slides[active_slide_idx]?.file_id || null,
                                            }
                                          : {}),
                                        image_size: panel_ai_image_size,
                                        output_format: panel_ai_output_format,
                                        reasoning_strength: panel_ai_reasoning_strength,
                                        enable_image_search: panel_ai_image_search,
                                        enable_web_search: panel_ai_web_search,
                                        enable_shell: panel_ai_shell,
                                        auto_improve_prompt: panel_ai_auto_improve_prompt,
                                      }
                                    : {}
                                );
                              }
                            }}
                            style={{ padding: '5px 12px', fontSize: 11, width: 'auto' }}
                          >
                            {is_tts_cmd ? <Volume2 size={11} /> : <Sparkles size={11} />}
                            <span>
                              {is_tts_cmd
                                ? `Confirm & Create Voice (${panel_tts_voice})`
                                : is_img_cmd
                                ? 'Create Image'
                                : is_code_cmd
                                ? 'Generate Code Snippet'
                                : 'Apply AI'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}

          <div className={styles['lumen-property-section'] || styles.lumenPropertySection}>
            <div className={styles['lumen-property-section-title'] || styles.lumenPropertySectionTitle}>
              <span>AI Co-Pilot & Context</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                className={styles['lumen-property-ai-btn'] || styles.lumenPropertyAiBtn}
                onClick={() => askAiAboutCard(selected_card.id)}
                title={
                  selected_card.type === 'stock'
                    ? `Analyze ticker symbol "${selected_card.symbol || 'MAPI.JK'}" with AI Co-Pilot`
                    : 'Analyze Card with AI Co-Pilot'
                }
              >
                <Sparkles size={14} />
                <span>
                  {selected_card.type === 'stock'
                    ? `Analyze Ticker "${selected_card.symbol || 'MAPI.JK'}" with AI`
                    : 'Analyze Card with AI Co-Pilot'}
                </span>
              </button>
              <div style={{ marginTop: 6 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <label
                    className={styles['lumen-property-label'] || styles.lumenPropertyLabel}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}
                  >
                    <Sparkles size={11} color="var(--lumen-accent, #2563eb)" />
                    <span>
                      {selected_card.type === 'image'
                        ? selected_card.ai_note_title || 'Image Card Note / Visual Mood (ai_notes)'
                        : 'AI Context & Clues (ai_notes)'}
                    </span>
                  </label>
                  {selected_card.type === 'image' &&
                    (selected_card.ai_notes || selected_card.content) && (
                      <button
                        type="button"
                        onClick={() => {
                          updateCard(
                            selected_card.id,
                            {
                              ai_notes: '',
                              content: '',
                              ai_note_title: '',
                            },
                            true
                          );
                          saveCurrentBoardToStore();
                          showToast('Cleared Image Card note');
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#dc2626',
                          fontSize: 10.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Clear Note
                      </button>
                    )}
                </div>
                <textarea
                  value={
                    selected_card.type === 'image'
                      ? selected_card.ai_notes || selected_card.content || ''
                      : selected_card.ai_notes || selected_card.aiNotes || ''
                  }
                  onChange={(e) => {
                    const next_val = e.target.value;
                    if (selected_card.type === 'image') {
                      updateCard(selected_card.id, {
                        ai_notes: next_val,
                        content: next_val,
                      });
                    } else {
                      updateCard(selected_card.id, { ai_notes: next_val });
                    }
                  }}
                  placeholder={
                    selected_card.type === 'image'
                      ? 'Visual mood, love poem, joke, motivational quote, or note shown on the Image Card...'
                      : 'Keywords and clues to help AI understand and find this card...'
                  }
                  rows={selected_card.type === 'image' ? 4 : 2}
                  className={styles['lumen-property-textarea'] || styles.lumenPropertyTextarea}
                  style={{ fontSize: 11.5, resize: 'vertical' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Actions */}
      <div className={styles['lumen-property-footer-actions'] || styles.lumenPropertyFooterActions}>
        <button
          type="button"
          className={styles['lumen-property-btn-secondary'] || styles.lumenPropertyBtnSecondary}
          onClick={() => duplicateCard(selected_card.id)}
          style={{ flex: 1 }}
          title="Duplicate Card"
        >
          <Copy size={13} />
          <span>Duplicate</span>
        </button>

        <button
          type="button"
          className={styles['lumen-property-danger-btn'] || styles.lumenPropertyDangerBtn}
          onClick={() => deleteCard(selected_card.id)}
          style={{ flex: 1 }}
          title="Delete Card"
        >
          <Trash2 size={13} />
          <span>Delete</span>
        </button>
      </div>
    </aside>
  );
}

export default LUMEN_card_property_panel;
