import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  Search,
  X,
  Activity,
  Coins,
  Gem,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import styles from './LUMEN_stock_card.module.css';
import { updateCard, showToast } from '../../signals/boardState.js';

const RANGE_OPTIONS = [
  { key: '1d', label: '1D', periodText: 'Hari ini' },
  { key: '5d', label: '5D', periodText: '5 hari terakhir' },
  { key: '1mo', label: '1M', periodText: '1 bulan terakhir' },
  { key: '6mo', label: '6M', periodText: '6 bulan terakhir' },
  { key: 'ytd', label: 'YTD', periodText: 'YTD' },
  { key: '1y', label: '1YEAR', periodText: '1 tahun terakhir' },
  { key: '5y', label: '5YEAR', periodText: '5 tahun terakhir' },
  { key: 'max', label: 'MAX', periodText: 'Sepanjang waktu' },
];

const ASSET_CATEGORIES = [
  { key: 'all', label: 'Semua' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'commodity', label: 'Komoditas & Sumber Daya' },
  { key: 'idx', label: 'Saham IDX' },
  { key: 'global', label: 'Tech Global' },
];

const QUICK_ASSETS = [
  // Crypto Currency
  { symbol: 'BTC-USD', label: 'Bitcoin (BTC)', category: 'crypto', icon: '₿' },
  { symbol: 'ETH-USD', label: 'Ethereum (ETH)', category: 'crypto', icon: 'Ξ' },
  { symbol: 'SOL-USD', label: 'Solana (SOL)', category: 'crypto', icon: '◎' },
  { symbol: 'BNB-USD', label: 'Binance Coin (BNB)', category: 'crypto', icon: '🔶' },
  { symbol: 'XRP-USD', label: 'Ripple (XRP)', category: 'crypto', icon: '✕' },
  { symbol: 'DOGE-USD', label: 'Dogecoin (DOGE)', category: 'crypto', icon: 'Ð' },

  // Resources & Commodities (Gold, Silver, Nickel, Coal, Oil, etc.)
  { symbol: 'GC=F', label: 'Emas / Gold (XAU)', category: 'commodity', icon: '🥇' },
  { symbol: 'SI=F', label: 'Perak / Silver (XAG)', category: 'commodity', icon: '🥈' },
  { symbol: 'NIKL', label: 'Nikel / Nickel (NIKL)', category: 'commodity', icon: '⛏️' },
  { symbol: 'COAL', label: 'Batu Bara / Coal (COAL)', category: 'commodity', icon: '🪨' },
  { symbol: 'CL=F', label: 'Minyak Mentah / Crude Oil WTI', category: 'commodity', icon: '🛢️' },
  { symbol: 'BZ=F', label: 'Minyak Brent / Brent Crude', category: 'commodity', icon: '⛽' },
  { symbol: 'HG=F', label: 'Tembaga / Copper', category: 'commodity', icon: '🧱' },
  { symbol: 'ANTM.JK', label: 'ANTM (Emas & Nikel)', category: 'commodity', icon: '💎' },
  { symbol: 'INCO.JK', label: 'INCO (Nikel)', category: 'commodity', icon: '⚙️' },
  { symbol: 'ADRO.JK', label: 'ADRO (Batu Bara)', category: 'commodity', icon: '⚡' },
  { symbol: 'PTBA.JK', label: 'PTBA (Batu Bara)', category: 'commodity', icon: '🏭' },
  { symbol: 'MEDC.JK', label: 'MEDC (Minyak & Gas)', category: 'commodity', icon: '🔥' },

  // IDX Equities
  { symbol: 'MAPI.JK', label: 'IDX: MAPI', category: 'idx', icon: '🛍️' },
  { symbol: 'BBCA.JK', label: 'IDX: BBCA', category: 'idx', icon: '🏦' },
  { symbol: 'BBRI.JK', label: 'IDX: BBRI', category: 'idx', icon: '💳' },
  { symbol: 'ASII.JK', label: 'IDX: ASII', category: 'idx', icon: '🚗' },

  // Global Tech
  { symbol: 'AAPL', label: 'Apple (AAPL)', category: 'global', icon: '🍎' },
  { symbol: 'NVDA', label: 'NVIDIA (NVDA)', category: 'global', icon: '💻' },
  { symbol: 'TSLA', label: 'Tesla (TSLA)', category: 'global', icon: '⚡' },
  { symbol: 'MSFT', label: 'Microsoft (MSFT)', category: 'global', icon: '🪟' },
];

export const WORLD_CURRENCIES = [
  { code: 'AED', name: 'UAE Dirham', rate: 3.6725 },
  { code: 'AFN', name: 'Afghan Afghani', rate: 71.5 },
  { code: 'ALL', name: 'Albanian Lek', rate: 93.2 },
  { code: 'AMD', name: 'Armenian Dram', rate: 388.5 },
  { code: 'ANG', name: 'Netherlands Antillean Guilder', rate: 1.79 },
  { code: 'AOA', name: 'Angolan Kwanza', rate: 915.0 },
  { code: 'ARS', name: 'Argentine Peso', rate: 985.0 },
  { code: 'AUD', name: 'Australian Dollar', rate: 1.54 },
  { code: 'AWG', name: 'Aruban Florin', rate: 1.79 },
  { code: 'AZN', name: 'Azerbaijani Manat', rate: 1.7 },
  { code: 'BAM', name: 'Bosnia-Herzegovina Convertible Mark', rate: 1.8 },
  { code: 'BBD', name: 'Barbadian Dollar', rate: 2.0 },
  { code: 'BDT', name: 'Bangladeshi Taka', rate: 119.5 },
  { code: 'BGN', name: 'Bulgarian Lev', rate: 1.8 },
  { code: 'BHD', name: 'Bahraini Dinar', rate: 0.376 },
  { code: 'BIF', name: 'Burundian Franc', rate: 2910.0 },
  { code: 'BMD', name: 'Bermudan Dollar', rate: 1.0 },
  { code: 'BND', name: 'Brunei Dollar', rate: 1.34 },
  { code: 'BOB', name: 'Bolivian Boliviano', rate: 6.91 },
  { code: 'BRL', name: 'Brazilian Real', rate: 5.75 },
  { code: 'BSD', name: 'Bahamian Dollar', rate: 1.0 },
  { code: 'BTN', name: 'Bhutanese Ngultrum', rate: 84.1 },
  { code: 'BWP', name: 'Botswanan Pula', rate: 13.6 },
  { code: 'BYN', name: 'Belarusian Ruble', rate: 3.27 },
  { code: 'BZD', name: 'Belize Dollar', rate: 2.0 },
  { code: 'CAD', name: 'Canadian Dollar', rate: 1.39 },
  { code: 'CDF', name: 'Congolese Franc', rate: 2850.0 },
  { code: 'CHF', name: 'Swiss Franc', rate: 0.88 },
  { code: 'CLP', name: 'Chilean Peso', rate: 965.0 },
  { code: 'CNY', name: 'Chinese Yuan', rate: 7.24 },
  { code: 'COP', name: 'Colombian Peso', rate: 4380.0 },
  { code: 'CRC', name: 'Costa Rican Colón', rate: 512.0 },
  { code: 'CUP', name: 'Cuban Peso', rate: 24.0 },
  { code: 'CVE', name: 'Cape Verdean Escudo', rate: 101.5 },
  { code: 'CZK', name: 'Czech Koruna', rate: 23.6 },
  { code: 'DJF', name: 'Djiboutian Franc', rate: 177.7 },
  { code: 'DKK', name: 'Danish Krone', rate: 6.88 },
  { code: 'DOP', name: 'Dominican Peso', rate: 60.2 },
  { code: 'DZD', name: 'Algerian Dinar', rate: 133.5 },
  { code: 'EGP', name: 'Egyptian Pound', rate: 49.3 },
  { code: 'ERN', name: 'Eritrean Nakfa', rate: 15.0 },
  { code: 'ETB', name: 'Ethiopian Birr', rate: 121.0 },
  { code: 'EUR', name: 'Euro', rate: 0.89 },
  { code: 'FJD', name: 'Fijian Dollar', rate: 2.26 },
  { code: 'FKP', name: 'Falkland Islands Pound', rate: 0.78 },
  { code: 'GBP', name: 'British Pound', rate: 0.78 },
  { code: 'GEL', name: 'Georgian Lari', rate: 2.73 },
  { code: 'GGP', name: 'Guernsey Pound', rate: 0.78 },
  { code: 'GHS', name: 'Ghanaian Cedi', rate: 15.9 },
  { code: 'GIP', name: 'Gibraltar Pound', rate: 0.78 },
  { code: 'GMD', name: 'Gambian Dalasi', rate: 71.0 },
  { code: 'GNF', name: 'Guinean Franc', rate: 8620.0 },
  { code: 'GTQ', name: 'Guatemalan Quetzal', rate: 7.72 },
  { code: 'GYD', name: 'Guyanaese Dollar', rate: 209.2 },
  { code: 'HKD', name: 'Hong Kong Dollar', rate: 7.78 },
  { code: 'HNL', name: 'Honduran Lempira', rate: 25.1 },
  { code: 'HTG', name: 'Haitian Gourde', rate: 131.5 },
  { code: 'HUF', name: 'Hungarian Forint', rate: 378.0 },
  { code: 'IDR', name: 'Rupiah Indonesia', rate: 18076.13 },
  { code: 'ILS', name: 'Israeli New Shekel', rate: 3.74 },
  { code: 'IMP', name: 'Manx Pound', rate: 0.78 },
  { code: 'INR', name: 'Indian Rupee', rate: 84.1 },
  { code: 'IQD', name: 'Iraqi Dinar', rate: 1310.0 },
  { code: 'IRR', name: 'Iranian Rial', rate: 42000.0 },
  { code: 'ISK', name: 'Icelandic Króna', rate: 138.5 },
  { code: 'JEP', name: 'Jersey Pound', rate: 0.78 },
  { code: 'JMD', name: 'Jamaican Dollar', rate: 158.0 },
  { code: 'JOD', name: 'Jordanian Dinar', rate: 0.709 },
  { code: 'JPY', name: 'Yen Jepang', rate: 155.0 },
  { code: 'KES', name: 'Kenyan Shilling', rate: 129.0 },
  { code: 'KGS', name: 'Kyrgystani Som', rate: 86.5 },
  { code: 'KHR', name: 'Cambodian Riel', rate: 4065.0 },
  { code: 'KMF', name: 'Comorian Franc', rate: 454.0 },
  { code: 'KPW', name: 'North Korean Won', rate: 900.0 },
  { code: 'KRW', name: 'South Korean Won', rate: 1395.0 },
  { code: 'KWD', name: 'Kuwaiti Dinar', rate: 0.307 },
  { code: 'KYD', name: 'Cayman Islands Dollar', rate: 0.833 },
  { code: 'KZT', name: 'Kazakhstani Tenge', rate: 492.0 },
  { code: 'LAK', name: 'Laotian Kip', rate: 21950.0 },
  { code: 'LBP', name: 'Lebanese Pound', rate: 89500.0 },
  { code: 'LKR', name: 'Sri Lankan Rupee', rate: 292.5 },
  { code: 'LRD', name: 'Liberian Dollar', rate: 192.0 },
  { code: 'LSL', name: 'Lesotho Loti', rate: 18.1 },
  { code: 'LYD', name: 'Libyan Dinar', rate: 4.86 },
  { code: 'MAD', name: 'Moroccan Dirham', rate: 9.92 },
  { code: 'MDL', name: 'Moldovan Leu', rate: 18.0 },
  { code: 'MGA', name: 'Malagasy Ariary', rate: 4650.0 },
  { code: 'MKD', name: 'Macedonian Denar', rate: 56.8 },
  { code: 'MMK', name: 'Myanmar Kyat', rate: 2100.0 },
  { code: 'MNT', name: 'Mongolian Tugrik', rate: 3410.0 },
  { code: 'MOP', name: 'Macanese Pataca', rate: 8.01 },
  { code: 'MRU', name: 'Mauritanian Ouguiya', rate: 39.7 },
  { code: 'MUR', name: 'Mauritian Rupee', rate: 46.5 },
  { code: 'MVR', name: 'Maldivian Rufiyaa', rate: 15.4 },
  { code: 'MWK', name: 'Malawian Kwacha', rate: 1735.0 },
  { code: 'MXN', name: 'Mexican Peso', rate: 20.3 },
  { code: 'MYR', name: 'Malaysian Ringgit', rate: 4.45 },
  { code: 'MZN', name: 'Mozambican Metical', rate: 63.9 },
  { code: 'NAD', name: 'Namibian Dollar', rate: 18.1 },
  { code: 'NGN', name: 'Nigerian Naira', rate: 1660.0 },
  { code: 'NIO', name: 'Nicaraguan Córdoba', rate: 36.8 },
  { code: 'NOK', name: 'Norwegian Krone', rate: 11.05 },
  { code: 'NPR', name: 'Nepalese Rupee', rate: 134.5 },
  { code: 'NZD', name: 'New Zealand Dollar', rate: 1.69 },
  { code: 'OMR', name: 'Omani Rial', rate: 0.385 },
  { code: 'PAB', name: 'Panamanian Balboa', rate: 1.0 },
  { code: 'PEN', name: 'Peruvian Sol', rate: 3.78 },
  { code: 'PGK', name: 'Papua New Guinean Kina', rate: 3.96 },
  { code: 'PHP', name: 'Philippine Peso', rate: 58.6 },
  { code: 'PKR', name: 'Pakistani Rupee', rate: 277.8 },
  { code: 'PLN', name: 'Polish Zloty', rate: 4.05 },
  { code: 'PYG', name: 'Paraguayan Guarani', rate: 7820.0 },
  { code: 'QAR', name: 'Qatari Rial', rate: 3.64 },
  { code: 'RON', name: 'Romanian Leu', rate: 4.6 },
  { code: 'RSD', name: ' Serbian Dinar', rate: 108.2 },
  { code: 'RUB', name: 'Russian Ruble', rate: 98.5 },
  { code: 'RWF', name: 'Rwandan Franc', rate: 1365.0 },
  { code: 'SAR', name: 'Saudi Riyal', rate: 3.75 },
  { code: 'SBD', name: 'Solomon Islands Dollar', rate: 8.45 },
  { code: 'SCR', name: 'Seychellois Rupee', rate: 14.3 },
  { code: 'SDG', name: 'Sudanese Pound', rate: 601.5 },
  { code: 'SEK', name: 'Swedish Krona', rate: 10.8 },
  { code: 'SGD', name: 'Singapore Dollar', rate: 1.34 },
  { code: 'SHP', name: 'Saint Helena Pound', rate: 0.78 },
  { code: 'SLE', name: 'Sierra Leonean Leone', rate: 22.6 },
  { code: 'SOS', name: 'Somali Shilling', rate: 571.0 },
  { code: 'SRD', name: 'Surinamese Dollar', rate: 35.2 },
  { code: 'SSP', name: 'South Sudanese Pound', rate: 1302.0 },
  { code: 'STN', name: 'São Tomé and Príncipe Dobra', rate: 22.7 },
  { code: 'SVC', name: 'Salvadoran Colón', rate: 8.75 },
  { code: 'SYP', name: 'Syrian Pound', rate: 13000.0 },
  { code: 'SZL', name: 'Swazi Lilangeni', rate: 18.1 },
  { code: 'THB', name: 'Thai Baht', rate: 34.6 },
  { code: 'TJS', name: 'Tajikistani Somoni', rate: 10.65 },
  { code: 'TMT', name: 'Turkmenistani Manat', rate: 3.5 },
  { code: 'TND', name: 'Tunisian Dinar', rate: 3.14 },
  { code: 'TOP', name: 'Tongan Paʻanga', rate: 2.37 },
  { code: 'TRY', name: 'Turkish Lira', rate: 34.4 },
  { code: 'TTD', name: 'Trinidad and Tobago Dollar', rate: 6.78 },
  { code: 'TWD', name: 'New Taiwan Dollar', rate: 32.4 },
  { code: 'TZS', name: 'Tanzanian Shilling', rate: 2680.0 },
  { code: 'UAH', name: 'Ukrainian Hryvnia', rate: 41.3 },
  { code: 'UGX', name: 'Ugandan Shilling', rate: 3675.0 },
  { code: 'USD', name: 'US Dollar', rate: 1.0 },
  { code: 'UYU', name: 'Uruguayan Peso', rate: 42.6 },
  { code: 'UZS', name: 'Uzbekistani Som', rate: 12820.0 },
  { code: 'VES', name: 'Venezuelan Bolívar', rate: 45.2 },
  { code: 'VND', name: 'Vietnamese Dong', rate: 25380.0 },
  { code: 'VUV', name: 'Vanuatu Vatu', rate: 120.5 },
  { code: 'WST', name: 'Samoan Tala', rate: 2.76 },
  { code: 'XAF', name: 'Central African CFA Franc', rate: 605.0 },
  { code: 'XCD', name: 'East Caribbean Dollar', rate: 2.7 },
  { code: 'XOF', name: 'West African CFA Franc', rate: 605.0 },
  { code: 'XPF', name: 'CFP Franc', rate: 110.0 },
  { code: 'YER', name: 'Yemeni Rial', rate: 250.3 },
  { code: 'ZAR', name: 'South African Rand', rate: 18.1 },
  { code: 'ZMW', name: 'Zambian Kwacha', rate: 27.3 },
  { code: 'ZWG', name: 'Zimbabwe Gold', rate: 25.5 },
];

const DEFAULT_FX_RATES = WORLD_CURRENCIES.reduce((acc, item) => {
  acc[item.code] = item.rate;
  return acc;
}, {
  USD: 1.0,
  IDR: 18076.13,
  EUR: 0.89,
  SGD: 1.34,
  JPY: 155.0,
  GBP: 0.78,
  AUD: 1.54,
  CNY: 7.24,
});

export const convert_currency = (amount, from_curr, to_curr, rates = DEFAULT_FX_RATES) => {
  if (amount === null || amount === undefined || isNaN(amount) || amount === 0) return 0;
  const from = (from_curr || 'USD').toUpperCase();
  const to = (to_curr || 'USD').toUpperCase();
  if (from === to) return Number(amount);

  const r = { ...DEFAULT_FX_RATES, ...(rates || {}) };
  const from_rate = r[from] || 1.0;
  const to_rate = r[to] || 1.0;

  const in_usd = Number(amount) / from_rate;
  const converted = in_usd * to_rate;
  return Number(converted);
};

export default function LUMEN_stock_card({ card }) {
  // FX Rates state
  const [fx_rates, set_fx_rates] = useState(DEFAULT_FX_RATES);

  // Normalize symbol: defaults to MAPI.JK (IDX: MAPI)
  const get_normalized_symbol = (sym) => {
    if (!sym) return 'MAPI.JK';
    const s = sym.trim().toUpperCase();

    // Map common crypto aliases
    if (s === 'BTC' || s === 'BITCOIN') return 'BTC-USD';
    if (s === 'ETH' || s === 'ETHEREUM') return 'ETH-USD';
    if (s === 'SOL' || s === 'SOLANA') return 'SOL-USD';
    if (s === 'BNB' || s === 'BINANCE') return 'BNB-USD';
    if (s === 'XRP' || s === 'RIPPLE') return 'XRP-USD';
    if (s === 'DOGE' || s === 'DOGECOIN') return 'DOGE-USD';
    if (s === 'ADA' || s === 'CARDANO') return 'ADA-USD';
    if (s === 'USDT' || s === 'TETHER') return 'USDT-USD';
    if (s === 'LTC' || s === 'LITECOIN') return 'LTC-USD';

    // Map common commodity & resource names
    if (s === 'GOLD' || s === 'EMAS' || s === 'XAU' || s === 'XAUUSD') return 'GC=F';
    if (s === 'SILVER' || s === 'PERAK' || s === 'XAG' || s === 'XAGUSD') return 'SI=F';
    if (s === 'OIL' || s === 'CRUDE' || s === 'MINYAK' || s === 'WTI') return 'CL=F';
    if (s === 'BRENT' || s === 'BRENT OIL' || s === 'BRENTOIL') return 'BZ=F';
    if (s === 'COAL' || s === 'BATUBARA' || s === 'BATU BARA') return 'COAL';
    if (s === 'NICKEL' || s === 'NIKEL') return 'NIKL';
    if (s === 'COPPER' || s === 'TEMBAGA') return 'HG=F';
    if (s === 'GAS' || s === 'NATURAL GAS' || s === 'NATURALGAS') return 'NG=F';
    if (s === 'PLATINUM' || s === 'PLATINA') return 'PL=F';

    if (/^IDX\s*[-:/]?\s*/i.test(s)) {
      const code = s.replace(/^IDX\s*[-:/]?\s*/i, '').trim();
      return code.endsWith('.JK') ? code : `${code}.JK`;
    }
    if (s === 'MAPI') return 'MAPI.JK';
    return s;
  };

  const active_symbol = get_normalized_symbol(card.symbol);
  const [stock_data, set_stock_data] = useState(null);
  const [is_loading, set_is_loading] = useState(false);
  const [selected_range, set_selected_range] = useState(card.range || '1d');
  const [selected_category, set_selected_category] = useState('all');
  const [auto_refresh_enabled, set_auto_refresh_enabled] = useState(true);
  const [tick_direction, set_tick_direction] = useState(null);
  const [prev_price, set_prev_price] = useState(null);

  // Search state
  const [search_query, set_search_query] = useState('');
  const [search_results, set_search_results] = useState([]);
  const [is_searching, set_is_searching] = useState(false);
  const [show_search_dropdown, set_show_search_dropdown] = useState(false);

  // Responsive Chart Dimensions & Hover State
  const [chart_dims, set_chart_dims] = useState({ width: 500, height: 135 });
  const [hover_point, set_hover_point] = useState(null);
  const [hover_pixel_x, set_hover_pixel_x] = useState(null);
  const chart_svg_ref = useRef(null);
  const search_timeout_ref = useRef(null);
  const quote_abort_ref = useRef(null);

  // Measure actual container size to ensure 1:1 crisp SVG rendering
  useEffect(() => {
    if (!chart_svg_ref.current) return;
    const update_dims = () => {
      if (chart_svg_ref.current) {
        const rect = chart_svg_ref.current.getBoundingClientRect();
        if (rect.width > 30) {
          set_chart_dims({
            width: Math.round(rect.width),
            height: Math.max(110, Math.round(rect.height > 60 ? rect.height : 135)),
          });
        }
      }
    };

    update_dims();
    const observer = new ResizeObserver(update_dims);
    observer.observe(chart_svg_ref.current);
    return () => observer.disconnect();
  }, []);

  // Format Helpers: No Fake Numbers (if null/undefined/0 outputs 0)
  const format_number = (num, curr) => {
    if (num === null || num === undefined || isNaN(num) || num === 0) {
      return curr && curr.toUpperCase() === 'IDR' ? '0,00' : '0.00';
    }
    const c = (curr || 'USD').toUpperCase();
    const is_idr = c === 'IDR';
    const is_eur = c === 'EUR';
    const is_jpy = c === 'JPY';
    const n = Number(num);
    const abs_n = Math.abs(n);

    if (is_idr) {
      return n.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: abs_n < 1 ? 4 : 2,
      });
    }
    if (is_eur) {
      return n.toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: abs_n < 1 ? 4 : 2,
      });
    }
    if (is_jpy && abs_n >= 10) {
      return n.toLocaleString('ja-JP', {
        maximumFractionDigits: 0,
      });
    }
    return n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: abs_n < 0.01 ? 6 : abs_n < 1 ? 4 : 2,
    });
  };

  const format_percent = (num, curr) => {
    if (num === null || num === undefined || isNaN(num) || num === 0) return '0,00%';
    const is_idr = curr && curr.toUpperCase() === 'IDR';
    const n = Math.abs(Number(num));
    if (is_idr) {
      return n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    }
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  };

  const format_market_cap = (cap, curr) => {
    if (!cap || isNaN(cap) || cap === 0) return '0';
    const is_idr = curr && curr.toUpperCase() === 'IDR';
    const n = Number(cap);
    if (is_idr) {
      if (n >= 1e12) {
        return (n / 1e12).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' T';
      }
      if (n >= 1e9) {
        return (n / 1e9).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' M';
      }
      return String(n);
    }
    if (n >= 1e12) return (n / 1e12).toFixed(2) + ' T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + ' M';
    return String(n);
  };

  const format_tick_number = (num, curr) => {
    const is_idr = curr && curr.toUpperCase() === 'IDR';
    const n = Number(num || 0);
    if (is_idr) {
      return n.toLocaleString('id-ID', { maximumFractionDigits: 0 });
    }
    return n.toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 2 : 0 });
  };

  const format_time_label = (timestamp_sec, range) => {
    if (!timestamp_sec) return '';
    const date = new Date(timestamp_sec * 1000);
    if (range === '1d') {
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    }
    if (range === '5d') {
      return `${date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })} ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const get_display_symbol = (sym, data) => {
    const s = (sym || '').trim().toUpperCase();
    if (s === 'MAPI.JK' || s === 'MAPI' || s === 'IDX - MAPI' || s === 'IDX:MAPI') {
      return 'IDX: MAPI';
    }
    if (s.endsWith('.JK')) {
      return `IDX: ${s.replace('.JK', '')}`;
    }
    return data?.symbol || s;
  };

  const get_display_exchange = (sym, data) => {
    const s = (sym || '').trim().toUpperCase();
    if (s.endsWith('.JK') || s.startsWith('IDX') || s === 'MAPI') {
      return 'IDX - Jakarta';
    }
    if (s.endsWith('-USD') || s.endsWith('-USDT')) {
      return 'Crypto / 24-7';
    }
    if (s.includes('=F') || s === 'COAL' || s === 'NIKL') {
      return 'Komoditas';
    }
    return data?.exchangeName || 'GLOBAL';
  };

  const get_display_name = (sym, data) => {
    const s = (sym || '').trim().toUpperCase();
    if (s === 'MAPI.JK' || s === 'MAPI') return 'PT Mitra Adiperkasa Tbk';
    if (s === 'BTC-USD') return 'Bitcoin (Crypto)';
    if (s === 'ETH-USD') return 'Ethereum (Crypto)';
    if (s === 'SOL-USD') return 'Solana (Crypto)';
    if (s === 'BNB-USD') return 'Binance Coin (Crypto)';
    if (s === 'XRP-USD') return 'Ripple (Crypto)';
    if (s === 'DOGE-USD') return 'Dogecoin (Crypto)';
    if (s === 'GC=F') return 'Emas / Gold Futures';
    if (s === 'SI=F') return 'Perak / Silver Futures';
    if (s === 'NIKL') return 'Nikel Resources (Nickel)';
    if (s === 'COAL') return 'Batu Bara Resources (Coal)';
    if (s === 'CL=F') return 'Minyak Mentah WTI (Crude Oil)';
    if (s === 'BZ=F') return 'Minyak Mentah Brent (Brent Crude)';
    if (s === 'HG=F') return 'Tembaga Futures (Copper)';
    if (s === 'ANTM.JK') return 'PT Aneka Tambang Tbk (Gold & Nickel)';
    if (s === 'INCO.JK') return 'PT Vale Indonesia Tbk (Nickel)';
    if (s === 'ADRO.JK') return 'PT Adaro Energy Indonesia Tbk (Coal)';
    return data?.shortName || s;
  };

  // Fetch Stock / Asset Quote with AbortController and timeout
  const fetch_quote = async (symbol = active_symbol, range = selected_range, is_silent = false) => {
    if (quote_abort_ref.current) {
      try {
        quote_abort_ref.current.abort();
      } catch (_) {}
    }
    const ctrl = new AbortController();
    quote_abort_ref.current = ctrl;

    if (!is_silent) set_is_loading(true);
    try {
      const timeout_id = setTimeout(() => {
        try { ctrl.abort(); } catch (_) {}
      }, 7500);

      const resp = await fetch(
        `/api/stocks/quote?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`,
        { signal: ctrl.signal }
      );
      clearTimeout(timeout_id);

      if (resp.ok) {
        const data = await resp.json();
        set_stock_data(data);

        // Detect tick direction
        const cur_price = data.regularMarketPrice ?? 0;
        if (prev_price !== null && cur_price !== prev_price) {
          if (cur_price > prev_price) {
            set_tick_direction('up');
          } else {
            set_tick_direction('down');
          }
          setTimeout(() => set_tick_direction(null), 1200);
        }
        set_prev_price(cur_price);

        // Keep card symbol and exchange updated, but preserve default title 'Stock Card' or user-customized title
        if (card.symbol !== symbol || !card.title || card.title === 'Global Stock Ticker' || card.title.includes(' · ')) {
          updateCard(card.id, {
            symbol,
            title: card.title && !card.title.includes(' · ') && card.title !== 'Global Stock Ticker' ? card.title : 'Stock Card',
            exchange: data.exchangeName || get_display_exchange(symbol, data),
          }, false);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[Stock Card] Notice fetching market quote:', err?.message || err);
      }
    } finally {
      if (quote_abort_ref.current === ctrl) {
        quote_abort_ref.current = null;
      }
      if (!is_silent) set_is_loading(false);
    }
  };

  // Initial Quote
  useEffect(() => {
    fetch_quote(active_symbol, selected_range);
    return () => {
      if (quote_abort_ref.current) {
        try { quote_abort_ref.current.abort(); } catch (_) {}
      }
    };
  }, [active_symbol, selected_range]);

  // Fetch live exchange rates for currency conversion
  useEffect(() => {
    fetch('/api/stocks/fx-rates')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.rates) {
          set_fx_rates((prev) => ({ ...prev, ...d.rates }));
        }
      })
      .catch(() => {});
  }, []);

  // Real-time Auto-refresh interval (10s)
  useEffect(() => {
    if (!auto_refresh_enabled) return;
    const interval_id = setInterval(() => {
      fetch_quote(active_symbol, selected_range, true);
    }, 10000);
    return () => clearInterval(interval_id);
  }, [active_symbol, selected_range, auto_refresh_enabled]);

  // Handle Search Input Debounce
  const handle_search_change = (e) => {
    const val = e.target.value;
    set_search_query(val);

    if (search_timeout_ref.current) {
      clearTimeout(search_timeout_ref.current);
    }

    if (!val.trim()) {
      set_search_results([]);
      set_show_search_dropdown(false);
      return;
    }

    search_timeout_ref.current = setTimeout(async () => {
      set_is_searching(true);
      try {
        const resp = await fetch(`/api/stocks/search?q=${encodeURIComponent(val.trim())}`);
        if (resp.ok) {
          const res = await resp.json();
          const items = Array.isArray(res) ? res : (res.quotes || []);
          set_search_results(items);
          set_show_search_dropdown(true);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[Stock Card] Search notice:', err?.message || err);
        }
      } finally {
        set_is_searching(false);
      }
    }, 280);
  };

  // Select new symbol from search or quick chips
  const handle_select_symbol = (new_symbol) => {
    const normalized = get_normalized_symbol(new_symbol);
    set_search_query('');
    set_show_search_dropdown(false);
    updateCard(card.id, {
      symbol: normalized,
      title: card.title && !card.title.includes(' · ') && card.title !== 'Global Stock Ticker' ? card.title : 'Stock Card',
    });
    fetch_quote(normalized, selected_range);
  };

  // Range change (1D, 5D, 1M, 6M, YTD, 1YEAR, 5YEAR, MAX)
  const handle_change_range = (rKey) => {
    set_selected_range(rKey);
    fetch_quote(active_symbol, rKey);
  };

  // Filter Quick Assets by Category
  const filtered_quick_assets = QUICK_ASSETS.filter((a) => {
    if (selected_category === 'all') return true;
    return a.category === selected_category;
  });

  // --------------------------------------------------------------------------
  // Financial Chart Geometry & Clean Proportions (Zero fake synthetic waves)
  // --------------------------------------------------------------------------
  const chart_points = (stock_data?.chartPoints || []).filter((p) => p && typeof p.price === 'number');
  const prices = chart_points.map((p) => p.price);

  const has_real_data = Boolean(
    stock_data &&
    stock_data.regularMarketPrice > 0 &&
    prices.length > 0
  );

  let raw_min = prices.length ? Math.min(...prices) : 0;
  let raw_max = prices.length ? Math.max(...prices) : 0;
  const prev_close = stock_data?.previousClose ?? 0;

  let y_min = raw_min;
  let y_max = raw_max;

  if (has_real_data) {
    if (selected_range === '1d') {
      const center_ref = prev_close > 0 ? prev_close : (prices[0] || raw_max);
      const max_diff = Math.max(
        Math.abs(raw_max - center_ref),
        Math.abs(raw_min - center_ref),
        center_ref * 0.015
      );
      const margin = max_diff * 1.25;
      y_min = Math.floor(center_ref - margin);
      y_max = Math.ceil(center_ref + margin);
    } else {
      const span = Math.max(1, raw_max - raw_min);
      y_min = Math.floor(raw_min - span * 0.08);
      y_max = Math.ceil(raw_max + span * 0.08);
    }
  } else {
    // Zero baseline state when no initial response / awaiting feed
    y_min = 0;
    y_max = 1;
  }

  const price_span = Math.max(0.0001, y_max - y_min);

  // Layout bounds
  const svg_width = Math.max(120, chart_dims.width || 500);
  const svg_height = Math.max(110, chart_dims.height || 135);
  const padding_left = stock_data?.currency === 'IDR' ? 44 : 36;
  const padding_right = 16;
  const padding_top = 12;
  const padding_bottom = 12;
  const usable_width = Math.max(20, svg_width - padding_left - padding_right);
  const usable_height = Math.max(20, svg_height - padding_top - padding_bottom);

  // Grid ticks
  const tick_count = 3;
  const grid_ticks = [];
  for (let i = 0; i <= tick_count; i++) {
    const val = y_min + (price_span * i) / tick_count;
    grid_ticks.push(has_real_data ? Math.round(val) : 0);
  }

  // Calculate pixel coordinates
  const coords = [];
  if (has_real_data && chart_points.length > 0) {
    chart_points.forEach((pt, idx) => {
      const x = padding_left + (idx / Math.max(1, chart_points.length - 1)) * usable_width;
      const normalized_y = (pt.price - y_min) / price_span;
      const y = padding_top + usable_height * (1 - Math.max(0, Math.min(1, normalized_y)));
      coords.push({ x, y, pt });
    });
  }

  let path_d = '';
  let area_d = '';

  if (coords.length === 1) {
    path_d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)} L ${(svg_width - padding_right).toFixed(1)} ${coords[0].y.toFixed(1)}`;
    area_d = `${path_d} L ${(svg_width - padding_right).toFixed(1)} ${(svg_height - padding_bottom).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(svg_height - padding_bottom).toFixed(1)} Z`;
  } else if (coords.length > 1) {
    path_d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const mid_x = (p1.x + p2.x) / 2;
      path_d += ` C ${mid_x.toFixed(1)} ${p1.y.toFixed(1)}, ${mid_x.toFixed(1)} ${p2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const last_x = coords[coords.length - 1].x.toFixed(1);
    const first_x = coords[0].x.toFixed(1);
    const bottom_y = (svg_height - padding_bottom).toFixed(1);
    area_d = `${path_d} L ${last_x} ${bottom_y} L ${first_x} ${bottom_y} Z`;
  }

  // Previous close reference line
  let prev_close_y = null;
  if (has_real_data && selected_range === '1d' && prev_close >= y_min && prev_close <= y_max) {
    const norm = (prev_close - y_min) / price_span;
    prev_close_y = padding_top + usable_height * (1 - norm);
  }

  const get_x_axis_labels = () => {
    if (selected_range === '1d') return ['09.00', '11.00', '13.00', '15.00'];
    if (selected_range === '5d') return ['Sen', 'Sel', 'Rab', 'Kam', 'Jum'];
    if (selected_range === '1mo') return ['1 Mar', '8 Mar', '15 Mar', '22 Mar', '29 Mar'];
    if (selected_range === '6mo') return ['Okt', 'Nov', 'Des', 'Jan', 'Feb', 'Mar'];
    if (selected_range === 'ytd') return ['Jan', 'Feb', 'Mar'];
    if (selected_range === '1y') return ['Apr', 'Jul', 'Okt', 'Jan', 'Apr'];
    if (selected_range === '5y') return ['2022', '2023', '2024', '2025', '2026'];
    return ['2004', '2009', '2014', '2019', '2024', '2026'];
  };

  const x_axis_labels = get_x_axis_labels();

  // Handle Chart Hover
  const handle_chart_mouse_move = (e) => {
    if (!chart_svg_ref.current || coords.length < 2) return;
    const rect = chart_svg_ref.current.getBoundingClientRect();
    const client_x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (client_x - padding_left) / usable_width));
    const target_idx = Math.round(ratio * (coords.length - 1));
    const matched = coords[target_idx];
    if (matched) {
      set_hover_point(matched);
      const clamped_x = Math.max(50, Math.min(svg_width - 50, matched.x));
      set_hover_pixel_x(clamped_x);
    }
  };

  const handle_chart_mouse_leave = () => {
    set_hover_point(null);
    set_hover_pixel_x(null);
  };

  const change_val = stock_data?.regularMarketChange ?? 0;
  const is_positive = change_val > 0;
  const is_zero = change_val === 0;
  const stroke_color = is_zero ? '#5f6368' : (is_positive ? '#137333' : '#c5221f');
  const fill_gradient_id = `lumen-stock-grad-${card.id}`;
  const is_market_open = stock_data?.marketState === 'REGULAR';
  const current_range_info = RANGE_OPTIONS.find((r) => r.key === selected_range) || RANGE_OPTIONS[0];

  const is_crypto = active_symbol.endsWith('-USD') || active_symbol.endsWith('-USDT');
  const is_commodity = active_symbol.includes('=F') || active_symbol === 'COAL' || active_symbol === 'NIKL';

  const is_awaiting_feed = !stock_data || stock_data.regularMarketPrice === 0 || stock_data.dataFetching;

  const card_description = (card.description || card.subtitle || card.content || '').trim();
  const card_url = (card.url || '').trim();

  // Currency selection & conversion logic
  const original_currency = (stock_data?.currency || (active_symbol.endsWith('.JK') ? 'IDR' : 'USD')).toUpperCase();
  const selected_target_currency = (card.target_currency || '').trim().toUpperCase();
  const has_custom_currency = Boolean(
    selected_target_currency &&
    selected_target_currency !== 'ORIGINAL' &&
    selected_target_currency !== original_currency
  );

  const raw_current_price = hover_point
    ? hover_point.pt.price
    : (stock_data?.regularMarketPrice ?? 0);

  const orig_price_formatted = format_number(raw_current_price, original_currency);
  const converted_price_num = has_custom_currency
    ? convert_currency(raw_current_price, original_currency, selected_target_currency, fx_rates)
    : raw_current_price;
  const converted_price_formatted = has_custom_currency
    ? format_number(converted_price_num, selected_target_currency)
    : orig_price_formatted;

  const handle_currency_change = (new_curr) => {
    const val = !new_curr || new_curr === 'ORIGINAL' || new_curr === original_currency ? undefined : new_curr;
    updateCard(card.id, { target_currency: val });
    showToast(val ? `Mata uang diatur ke ${val}` : `Mata uang kembali ke asal (${original_currency})`);
  };

  return (
    <div className={styles['lumen-stock-card-container']}>
      {/* 1. Header with Identity & Real-time Live Badge */}
      <div className={styles['lumen-stock-header']}>
        <div className={styles['lumen-stock-identity']}>
          <div className={styles['lumen-stock-symbol-row']}>
            <span className={styles['lumen-stock-symbol-badge']}>
              {get_display_symbol(active_symbol, stock_data)}
            </span>
            <span className={styles['lumen-stock-exchange-tag']}>
              {get_display_exchange(active_symbol, stock_data)}
            </span>
          </div>
          <span className={styles['lumen-stock-name']}>
            {get_display_name(active_symbol, stock_data)}
          </span>
        </div>

        <div className={styles['lumen-stock-status-wrap']}>
          <span
            className={`${styles['lumen-stock-market-badge']} ${
              is_market_open
                ? styles['lumen-stock-market-open']
                : styles['lumen-stock-market-closed']
            }`}
            title={is_market_open ? 'Pasar buka untuk perdagangan real-time' : 'Pasar telah ditutup'}
          >
            <span className={styles['lumen-stock-pulse-dot']} />
            <span>{is_market_open ? 'Live' : 'Tutup'}</span>
          </span>

          <button
            type="button"
            className={styles['lumen-stock-refresh-btn']}
            onClick={() => fetch_quote(active_symbol, selected_range)}
            title="Refresh kuotasi harga real-time"
          >
            <RefreshCw
              size={12}
              className={is_loading ? styles['lumen-stock-refresh-spinning'] : ''}
            />
          </button>
        </div>
      </div>

      {/* Category Tabs: Semua, Crypto, Komoditas & Sumber Daya, Saham IDX, Global Tech */}
      <div className={styles['lumen-stock-category-tabs']}>
        {ASSET_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            className={`${styles['lumen-stock-category-btn']} ${
              selected_category === cat.key ? styles['lumen-stock-category-btn-active'] : ''
            }`}
            onClick={() => set_selected_category(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Quick Asset Chips Carousel (Instant 1-Click Switcher for Crypto, Gold, Silver, Nickel, Coal, Oil, etc.) */}
      <div className={styles['lumen-stock-quick-chips-row']}>
        {filtered_quick_assets.map((asset) => {
          const is_active = active_symbol === asset.symbol;
          return (
            <button
              key={asset.symbol}
              type="button"
              className={`${styles['lumen-stock-quick-chip']} ${
                is_active ? styles['lumen-stock-quick-chip-active'] : ''
              }`}
              onClick={() => handle_select_symbol(asset.symbol)}
              title={`Switch to ${asset.label}`}
            >
              <span className={styles['lumen-stock-quick-chip-icon']}>{asset.icon}</span>
              <span>{asset.label}</span>
            </button>
          );
        })}
      </div>

      {/* Data Fetching Info Notice (When No Initial Data / 0 Feed) */}
      {is_awaiting_feed && (
        <div className={styles['lumen-stock-fetching-banner']}>
          <span className={styles['lumen-stock-fetching-dot']} />
          <span>
            {is_loading
              ? 'Memuat data harga pasar real-time...'
              : 'Menunggu response feed data pasar real-time (0)...'}
          </span>
        </div>
      )}

      {/* 2. Big Real-Time Price Row, Currency Selector & Period Returns */}
      <div
        className={`${styles['lumen-stock-price-section']} ${
          tick_direction === 'up'
            ? styles['lumen-stock-price-up-flash']
            : tick_direction === 'down'
            ? styles['lumen-stock-price-down-flash']
            : ''
        }`}
      >
        <div className={styles['lumen-stock-price-header-row']}>
          <div className={styles['lumen-stock-price-hero']}>
            {has_custom_currency ? (
              <div className={styles['lumen-stock-price-dual-container']}>
                <span className={styles['lumen-stock-price-val']}>
                  {orig_price_formatted}
                </span>
                <span className={styles['lumen-stock-currency-code']}>
                  {original_currency}
                </span>
                <span className={styles['lumen-stock-currency-slash']}>/</span>
                <span className={styles['lumen-stock-price-converted-val']}>
                  {converted_price_formatted}
                </span>
                <span className={styles['lumen-stock-currency-code-converted']}>
                  {selected_target_currency}
                </span>
              </div>
            ) : (
              <>
                <span className={styles['lumen-stock-price-val']}>
                  {orig_price_formatted}
                </span>
                <span className={styles['lumen-stock-currency-code']}>
                  {original_currency}
                </span>
              </>
            )}
          </div>

          {/* Currency Selector Dropdown */}
          <div className={styles['lumen-stock-currency-select-box']}>
            <Coins size={11} className={styles['lumen-stock-currency-select-icon']} />
            <select
              className={styles['lumen-stock-currency-select']}
              value={card.target_currency || 'ORIGINAL'}
              onChange={(e) => handle_currency_change(e.target.value)}
              title="Pilih konversi mata uang / kurs"
            >
              <option value="ORIGINAL">Mata Uang: Asli ({original_currency})</option>
              {WORLD_CURRENCIES.map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {curr.code} ({curr.name.trim()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Currency Quick Filter Chips */}
        <div className={styles['lumen-stock-currency-chips-bar']}>
          <span className={styles['lumen-stock-currency-chips-label']}>Kurs:</span>
          {[
            { key: 'ORIGINAL', label: `Asli (${original_currency})` },
            { key: 'IDR', label: 'IDR' },
            { key: 'USD', label: 'USD' },
            { key: 'EUR', label: 'EUR' },
            { key: 'SGD', label: 'SGD' },
          ].map((c) => {
            const is_active = (!card.target_currency && c.key === 'ORIGINAL') || card.target_currency === c.key;
            return (
              <button
                key={c.key}
                type="button"
                className={`${styles['lumen-stock-currency-chip']} ${
                  is_active ? styles['lumen-stock-currency-chip-active'] : ''
                }`}
                onClick={() => handle_currency_change(c.key)}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className={styles['lumen-stock-returns-row']}>
          <div
            className={`${styles['lumen-stock-change-pill']} ${
              is_zero
                ? styles['lumen-stock-change-neutral']
                : is_positive
                ? styles['lumen-stock-change-up']
                : styles['lumen-stock-change-down']
            }`}
          >
            {!is_zero && <span>{is_positive ? '↑' : '↓'}</span>}
            <span>{format_percent(stock_data?.regularMarketChangePercent ?? 0, stock_data?.currency)}</span>
          </div>

          <span
            className={`${styles['lumen-stock-change-detail']} ${
              is_zero
                ? styles['lumen-stock-text-neutral']
                : is_positive
                ? styles['lumen-stock-text-up']
                : styles['lumen-stock-text-down']
            }`}
          >
            {is_positive ? '+' : ''}{format_number(stock_data?.regularMarketChange ?? 0, original_currency)} {original_currency}
            {has_custom_currency && (
              <> / {is_positive ? '+' : ''}{format_number(convert_currency(stock_data?.regularMarketChange ?? 0, original_currency, selected_target_currency, fx_rates), selected_target_currency)} {selected_target_currency}</>
            )} {current_range_info.periodText}
          </span>
        </div>

        <span className={styles['lumen-stock-meta-timestamp']}>
          {stock_data?.timestamp
            ? `Pembaruan: ${new Date(stock_data.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, ${new Date(stock_data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB • Asal: ${original_currency}${has_custom_currency ? ` • Target: ${selected_target_currency}` : ''}`
            : 'Menunggu feed data pasar terkini (0)...'}
        </span>
      </div>

      {/* 3. Search Bar for Crypto, Resources, Equities & Commodities */}
      <div className={styles['lumen-stock-search-wrap']}>
        <div className={styles['lumen-stock-search-input-box']}>
          <Search size={11} color="#64748b" />
          <input
            type="text"
            className={styles['lumen-stock-search-input']}
            placeholder="Cari asset (misal: BTC, Gold, Silver, Nickel, Coal, Oil, MAPI)..."
            value={search_query}
            onChange={handle_search_change}
            onFocus={() => {
              if (search_results.length > 0) set_show_search_dropdown(true);
            }}
          />
          {search_query && (
            <button
              type="button"
              className={styles['lumen-stock-search-clear']}
              onClick={() => {
                set_search_query('');
                set_show_search_dropdown(false);
              }}
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {show_search_dropdown && search_results.length > 0 && (
          <div className={styles['lumen-stock-search-dropdown']}>
            {search_results.map((res) => (
              <button
                key={res.symbol}
                type="button"
                className={styles['lumen-stock-search-item']}
                onClick={() => handle_select_symbol(res.symbol)}
              >
                <span className={styles['lumen-stock-search-item-symbol']}>
                  {res.symbol === 'MAPI.JK' ? 'IDX: MAPI' : res.symbol}
                </span>
                <span className={styles['lumen-stock-search-item-name']}>{res.shortName}</span>
                <span className={styles['lumen-stock-search-item-exch']}>{res.exchange || res.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. Chart Section: 8 View Modes & Interactive Gridline Chart */}
      <div className={styles['lumen-stock-chart-section']}>
        {/* 8 Range View Modes: 1D, 5D, 1M, 6M, YTD, 1YEAR, 5YEAR, MAX */}
        <div className={styles['lumen-stock-range-tabs']}>
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`${styles['lumen-stock-range-btn']} ${
                selected_range === r.key ? styles['lumen-stock-range-btn-active'] : ''
              }`}
              onClick={() => handle_change_range(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div
          ref={chart_svg_ref}
          className={styles['lumen-stock-chart-svg-wrap']}
          onMouseMove={handle_chart_mouse_move}
          onMouseLeave={handle_chart_mouse_leave}
        >
          {hover_point && hover_pixel_x != null && (
            <div
              className={styles['lumen-stock-chart-tooltip']}
              style={{ left: `${hover_pixel_x}px` }}
            >
              <span className={styles['lumen-stock-tooltip-price']}>
                {has_custom_currency ? (
                  `${format_number(hover_point.pt.price, original_currency)} ${original_currency} / ${format_number(convert_currency(hover_point.pt.price, original_currency, selected_target_currency, fx_rates), selected_target_currency)} ${selected_target_currency}`
                ) : (
                  `${format_number(hover_point.pt.price, original_currency)} ${original_currency}`
                )}
              </span>
              {hover_point.pt.time && (
                <span className={styles['lumen-stock-tooltip-time']}>
                  {format_time_label(hover_point.pt.time, selected_range)}
                </span>
              )}
            </div>
          )}

          {!has_real_data ? (
            <div className={styles['lumen-stock-empty-chart-info']}>
              <Activity size={18} color="#94a3b8" />
              <span>Memuat data grafik real-time (0)...</span>
            </div>
          ) : (
            <svg
              className={styles['lumen-stock-chart-svg']}
              viewBox={`0 0 ${svg_width} ${svg_height}`}
              width="100%"
              height={svg_height}
            >
              <defs>
                <linearGradient id={fill_gradient_id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke_color} stopOpacity="0.12" />
                  <stop offset="100%" stopColor={stroke_color} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines and Price Labels */}
              {grid_ticks.map((t, idx) => {
                const tick_y = padding_top + usable_height * (1 - (t - y_min) / price_span);
                return (
                  <g key={`${t}-${idx}`}>
                    <line
                      x1={padding_left}
                      y1={tick_y.toFixed(1)}
                      x2={(svg_width - padding_right).toFixed(1)}
                      y2={tick_y.toFixed(1)}
                      stroke="var(--lumen-canvas-grid-line, rgba(148, 163, 184, 0.2))"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={padding_left - 5}
                      y={(tick_y + 3).toFixed(1)}
                      textAnchor="end"
                      fill="#94a3b8"
                      fontSize="8.5"
                      fontWeight="500"
                      fontFamily="inherit"
                    >
                      {format_tick_number(t, stock_data?.currency)}
                    </text>
                  </g>
                );
              })}

              {/* Previous Close Reference Line */}
              {prev_close_y !== null && (
                <line
                  x1={padding_left}
                  y1={prev_close_y.toFixed(1)}
                  x2={(svg_width - padding_right).toFixed(1)}
                  y2={prev_close_y.toFixed(1)}
                  stroke="rgba(100, 116, 139, 0.35)"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* Area Fill Under Curve */}
              {area_d && (
                <path d={area_d} fill={`url(#${fill_gradient_id})`} />
              )}

              {/* Smooth Spline Stroke Line */}
              {path_d && (
                <path
                  d={path_d}
                  fill="none"
                  stroke={stroke_color}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* Endpoint Dot on Latest Price */}
              {coords.length > 0 && !hover_point && (
                <circle
                  cx={coords[coords.length - 1].x.toFixed(1)}
                  cy={coords[coords.length - 1].y.toFixed(1)}
                  r="3"
                  fill={stroke_color}
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* Hover Crosshair and Dot */}
              {hover_point && (
                <g>
                  <line
                    x1={hover_point.x.toFixed(1)}
                    y1={padding_top}
                    x2={hover_point.x.toFixed(1)}
                    y2={(svg_height - padding_bottom).toFixed(1)}
                    stroke="rgba(100, 116, 139, 0.45)"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={hover_point.x.toFixed(1)}
                    cy={hover_point.y.toFixed(1)}
                    r="4"
                    fill="#ffffff"
                    stroke={stroke_color}
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )}
            </svg>
          )}

          {/* Time axis markers at bottom */}
          <div className={styles['lumen-stock-x-axis-row']} style={{ paddingLeft: `${padding_left}px`, paddingRight: `${padding_right}px` }}>
            {x_axis_labels.map((lbl, idx) => (
              <span key={idx} className={styles['lumen-stock-x-axis-label']}>{lbl}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 5. 3x3 Financial Metrics Table: Zero Defaults (No Fake Initial Numbers) */}
      <div className={styles['lumen-stock-metrics-grid']}>
        {/* Column 1: Pembukaan, Kap. pasar, Rasio P/E */}
        <div className={styles['lumen-stock-metric-card']}>
          <span className={styles['lumen-stock-metric-label']}>Pembukaan</span>
          <span className={styles['lumen-stock-metric-val']}>
            {format_number(stock_data?.regularMarketOpen ?? 0, stock_data?.currency)}
          </span>
        </div>

        <div className={styles['lumen-stock-metric-card']}>
          <span className={styles['lumen-stock-metric-label']}>Kap. pasar</span>
          <span className={styles['lumen-stock-metric-val']}>
            {format_market_cap(stock_data?.marketCap ?? 0, stock_data?.currency)}
          </span>
        </div>

        <div className={styles['lumen-stock-metric-card']}>
          <span className={styles['lumen-stock-metric-label']}>Rasio P/E</span>
          <span className={styles['lumen-stock-metric-val']}>
            {stock_data?.peRatio != null && stock_data.peRatio > 0
              ? Number(stock_data.peRatio).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : (is_crypto || is_commodity ? '— (N/A)' : '0')}
          </span>
        </div>

        {/* Column 2: Tertinggi, Tinggi 52 mg, Hasil dividen */}
        <div className={styles['lumen-stock-metric-card']}>
          <span className={styles['lumen-stock-metric-label']}>Tertinggi</span>
          <span className={styles['lumen-stock-metric-val']}>
            {format_number(stock_data?.regularMarketDayHigh ?? 0, stock_data?.currency)}
          </span>
        </div>

        <div className={styles['lumen-stock-metric-card']}>
          <span className={styles['lumen-stock-metric-label']}>Tinggi 52 mg</span>
          <span className={styles['lumen-stock-metric-val']}>
            {format_number(stock_data?.fiftyTwoWeekHigh ?? 0, stock_data?.currency)}
          </span>
        </div>

        <div className={styles['lumen-stock-metric-card']}>
          <span className={styles['lumen-stock-metric-label']}>Hasil dividen</span>
          <span className={styles['lumen-stock-metric-val']}>
            {stock_data?.dividendYield != null && stock_data.dividendYield > 0
              ? format_percent(stock_data.dividendYield, stock_data?.currency)
              : (is_crypto || is_commodity ? '— (N/A)' : '0,00%')}
          </span>
        </div>

        {/* Column 3: Terendah, Rndh 52 mg, Tutup sebelumnya */}
        <div className={styles['lumen-stock-metric-card']}>
          <span className={styles['lumen-stock-metric-label']}>Terendah</span>
          <span className={styles['lumen-stock-metric-val']}>
            {format_number(stock_data?.regularMarketDayLow ?? 0, stock_data?.currency)}
          </span>
        </div>

        <div className={styles['lumen-stock-metric-card']}>
          <span className={styles['lumen-stock-metric-label']}>Rndh 52 mg</span>
          <span className={styles['lumen-stock-metric-val']}>
            {format_number(stock_data?.fiftyTwoWeekLow ?? 0, stock_data?.currency)}
          </span>
        </div>

        <div className={styles['lumen-stock-metric-card']}>
          <span className={styles['lumen-stock-metric-label']}>Tutup sebelumnya</span>
          <span className={styles['lumen-stock-metric-val']}>
            {format_number(stock_data?.previousClose ?? 0, stock_data?.currency)}
          </span>
        </div>
      </div>

      {/* 6. Footer with Auto-Refresh Controls */}
      <div className={styles['lumen-stock-footer']}>
        <div className={styles['lumen-stock-footer-left']}>
          <button
            type="button"
            className={`${styles['lumen-stock-auto-toggle']} ${
              auto_refresh_enabled ? styles['lumen-stock-auto-active'] : ''
            }`}
            onClick={() => {
              set_auto_refresh_enabled(!auto_refresh_enabled);
              showToast(auto_refresh_enabled ? 'Real-time auto-refresh dinonaktifkan' : 'Real-time auto-refresh aktif');
            }}
          >
            <Activity size={10} />
            <span>{auto_refresh_enabled ? 'Real-time (10s)' : 'Jeda'}</span>
          </button>
        </div>
        <span>
          {stock_data?.timestamp
            ? `Diperbarui ${new Date(stock_data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : 'Menunggu feed real-time (0)'}
        </span>
      </div>

      {/* Description / Content & URL Display (Positioned at bottom, after the footer div) */}
      {(card_description || card_url) && (
        <div className={styles['lumen-stock-meta-footer-section']}>
          {card_description && (
            <div className={styles['lumen-stock-bottom-content']}>
              <p className={styles['lumen-stock-bottom-description']} title={card_description}>
                {card_description}
              </p>
            </div>
          )}

          {card_url && (
            <div className={styles['lumen-stock-bottom-url-row']}>
              <a
                href={card_url.startsWith('http://') || card_url.startsWith('https://') ? card_url : `https://${card_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles['lumen-stock-bottom-url-link']}
                onClick={(e) => e.stopPropagation()}
                title={`Open URL: ${card_url}`}
              >
                <ExternalLink size={11} className={styles['lumen-stock-bottom-url-icon']} />
                <span className={styles['lumen-stock-bottom-url-text']}>
                  {card_url.replace(/^https?:\/\/(www\.)?/, '')}
                </span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
