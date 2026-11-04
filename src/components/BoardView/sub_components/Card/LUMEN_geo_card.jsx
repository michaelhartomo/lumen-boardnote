import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  MapPin,
  ExternalLink,
  Navigation,
  Compass,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  Globe,
  X,
  Plus,
  Route,
  Car,
  Train,
  Footprints,
  Bike,
  Milestone,
  ArrowUpDown,
  RotateCcw,
  ListPlus,
  Layers,
  Search,
} from 'lucide-react';

import styles from './LUMEN_geo_card.module.css';
import {
  updateCard,
  showToast,
  saveCurrentBoardToStore,
} from '../../signals/boardState.js';
import { api_search_places } from '../../utils/lumenApi.js';

export const TRAVEL_MODES = [
  { id: 'driving', label: 'Driving', icon: Car, emoji: '🚗' },
  { id: 'transit', label: 'Transit', icon: Train, emoji: '🚆' },
  { id: 'walking', label: 'Walking', icon: Footprints, emoji: '🚶' },
  { id: 'bicycling', label: 'Cycling', icon: Bike, emoji: '🚴' },
];

/**
 * Calculates geodesic distance between two points in km (Haversine formula)
 */
export function calculate_haversine_km(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates total route distance across sequential destinations
 */
export function calculate_total_route_distance(destinations) {
  if (!destinations || destinations.length < 2) return null;
  let total_km = 0;
  for (let i = 0; i < destinations.length - 1; i++) {
    const d1 = destinations[i];
    const d2 = destinations[i + 1];
    if (
      typeof d1.latitude === 'number' &&
      typeof d1.longitude === 'number' &&
      typeof d2.latitude === 'number' &&
      typeof d2.longitude === 'number'
    ) {
      total_km += calculate_haversine_km(d1.latitude, d1.longitude, d2.latitude, d2.longitude);
    }
  }
  if (total_km === 0) return null;
  const km_str = total_km < 10 ? total_km.toFixed(1) : Math.round(total_km);
  const miles = total_km * 0.621371;
  const miles_str = miles < 10 ? miles.toFixed(1) : Math.round(miles);
  return `${km_str} km (${miles_str} mi)`;
}

/**
 * Generates an official Google Maps Multi-Destination directions URL
 * Syntax: https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...&travelmode=...
 */
export function build_google_maps_directions_url(destinations, travel_mode = 'driving') {
  if (!destinations || destinations.length === 0) return 'https://www.google.com/maps';

  const get_target = (item) => {
    if (typeof item.latitude === 'number' && typeof item.longitude === 'number') {
      return `${item.latitude.toFixed(6)},${item.longitude.toFixed(6)}`;
    }
    return item.name || item.address || '';
  };

  if (destinations.length === 1) {
    const single_query = get_target(destinations[0]);
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(single_query)}`;
  }

  const origin = destinations[0];
  const dest = destinations[destinations.length - 1];
  const waypoints = destinations.slice(1, -1);

  const origin_str = get_target(origin);
  const dest_str = get_target(dest);
  const waypoints_str = waypoints.map(get_target).filter(Boolean).join('|');

  let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin_str)}&destination=${encodeURIComponent(dest_str)}`;

  if (waypoints_str) {
    url += `&waypoints=${encodeURIComponent(waypoints_str)}`;
  }

  if (travel_mode) {
    url += `&travelmode=${encodeURIComponent(travel_mode)}`;
  }

  return url;
}

/**
 * Generates Apple Maps multi-stop directions URL
 */
export function build_apple_maps_directions_url(destinations) {
  if (!destinations || destinations.length === 0) return 'https://maps.apple.com/';
  const get_target = (item) => {
    if (typeof item.latitude === 'number' && typeof item.longitude === 'number') {
      return `${item.latitude},${item.longitude}`;
    }
    return item.name || item.address || '';
  };
  if (destinations.length === 1) {
    return `https://maps.apple.com/?q=${encodeURIComponent(get_target(destinations[0]))}`;
  }
  const saddr = get_target(destinations[0]);
  const daddr = get_target(destinations[destinations.length - 1]);
  return `https://maps.apple.com/?saddr=${encodeURIComponent(saddr)}&daddr=${encodeURIComponent(daddr)}`;
}

/**
 * Generates OpenStreetMap multi-stop route URL
 */
export function build_osm_directions_url(destinations) {
  if (!destinations || destinations.length === 0) return 'https://www.openstreetmap.org/';
  const valid_coords = destinations.filter(
    (d) => typeof d.latitude === 'number' && typeof d.longitude === 'number'
  );
  if (valid_coords.length < 2) {
    const p = destinations[0];
    if (p && typeof p.latitude === 'number' && typeof p.longitude === 'number') {
      return `https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=15/${p.latitude}/${p.longitude}`;
    }
    return 'https://www.openstreetmap.org/';
  }
  const route_coords = valid_coords.map((d) => `${d.latitude.toFixed(5)},${d.longitude.toFixed(5)}`).join(';');
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${route_coords}`;
}

/**
 * Computes bounding box and OpenStreetMap embed URL fitting all destinations
 */
export function compute_destinations_bbox(destinations, zoom = 15) {
  const valid = (destinations || []).filter(
    (d) => typeof d.latitude === 'number' && typeof d.longitude === 'number'
  );

  if (valid.length === 0) {
    return {
      center_lat: 34.9949,
      center_lng: 135.785,
      osm_embed_url:
        'https://www.openstreetmap.org/export/embed.html?bbox=135.77%2C34.98%2C135.80%2C35.01&layer=mapnik&marker=34.9949%2C135.7850',
    };
  }

  if (valid.length === 1) {
    const p = valid[0];
    const z = Math.max(3, Math.min(19, zoom || 15));
    const delta = (360 / Math.pow(2, z)) * 0.7;
    const bbox = `${(p.longitude - delta).toFixed(5)}%2C${(p.latitude - delta).toFixed(5)}%2C${(p.longitude + delta).toFixed(5)}%2C${(p.latitude + delta).toFixed(5)}`;
    return {
      center_lat: p.latitude,
      center_lng: p.longitude,
      osm_embed_url: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${p.latitude.toFixed(5)}%2C${p.longitude.toFixed(5)}`,
    };
  }

  const lats = valid.map((d) => d.latitude);
  const lngs = valid.map((d) => d.longitude);
  const min_lat = Math.min(...lats);
  const max_lat = Math.max(...lats);
  const min_lng = Math.min(...lngs);
  const max_lng = Math.max(...lngs);

  const lat_span = max_lat - min_lat;
  const lng_span = max_lng - min_lng;
  const lat_pad = Math.max(0.008, lat_span * 0.25);
  const lng_pad = Math.max(0.008, lng_span * 0.25);

  const bbox_min_lat = min_lat - lat_pad;
  const bbox_max_lat = max_lat + lat_pad;
  const bbox_min_lng = min_lng - lng_pad;
  const bbox_max_lng = max_lng + lng_pad;

  const center_lat = (min_lat + max_lat) / 2;
  const center_lng = (min_lng + max_lng) / 2;

  const bbox_str = `${bbox_min_lng.toFixed(5)}%2C${bbox_min_lat.toFixed(5)}%2C${bbox_max_lng.toFixed(5)}%2C${bbox_max_lat.toFixed(5)}`;
  const osm_embed_url = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox_str}&layer=mapnik&marker=${center_lat.toFixed(5)}%2C${center_lng.toFixed(5)}`;

  return {
    center_lat,
    center_lng,
    osm_embed_url,
  };
}

/**
 * Normalizes card destinations, falling back to card's primary coordinates
 */
export function normalize_card_destinations(card) {
  if (Array.isArray(card.destinations) && card.destinations.length > 0) {
    return card.destinations;
  }
  const lat = typeof card.latitude === 'number' ? card.latitude : 34.9949;
  const lng = typeof card.longitude === 'number' ? card.longitude : 135.785;
  const name = card.location_name || card.title || 'Kyoto Design Pavilion';
  const address = card.address || `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
  return [
    {
      id: 'dest_primary_1',
      name,
      address,
      latitude: lat,
      longitude: lng,
    },
  ];
}

/**
 * Parses Google Maps Multi-Destination directions URLs
 * Handles:
 * - Query API: ?api=1&origin=...&destination=...&waypoints=...
 * - Web path: /dir/Stop1/Stop2/Stop3/...
 */
export function parse_google_maps_directions_url(raw_input) {
  if (!raw_input || typeof raw_input !== 'string') return null;
  const input = raw_input.trim();

  // Pattern 1: URL with query parameters ?api=1&origin=...&destination=...
  if (input.includes('origin=') && (input.includes('destination=') || input.includes('waypoints='))) {
    try {
      const url_obj = new URL(input.startsWith('http') ? input : 'https://' + input);
      const origin_param = url_obj.searchParams.get('origin');
      const dest_param = url_obj.searchParams.get('destination');
      const waypoints_param = url_obj.searchParams.get('waypoints');
      const mode_param = url_obj.searchParams.get('travelmode') || 'driving';

      const destinations = [];

      const make_dest_obj = (val, idx) => {
        const decoded = decodeURIComponent(val.replace(/\+/g, ' ')).trim();
        const coord_match = decoded.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
        let lat = undefined;
        let lng = undefined;
        if (coord_match) {
          lat = parseFloat(coord_match[1]);
          lng = parseFloat(coord_match[2]);
        }
        return {
          id: `dest_parsed_${Date.now()}_${idx}`,
          name: decoded,
          address: decoded,
          latitude: lat,
          longitude: lng,
        };
      };

      if (origin_param) {
        destinations.push(make_dest_obj(origin_param, 0));
      }
      if (waypoints_param) {
        const wp_list = waypoints_param.split('|');
        wp_list.forEach((wp, i) => {
          if (wp.trim()) {
            destinations.push(make_dest_obj(wp, i + 1));
          }
        });
      }
      if (dest_param) {
        destinations.push(make_dest_obj(dest_param, destinations.length));
      }

      if (destinations.length > 0) {
        return {
          is_directions: true,
          destinations,
          travel_mode: mode_param,
          location_name: `Route: ${destinations[0]?.name} → ${destinations[destinations.length - 1]?.name}`,
        };
      }
    } catch (e) {
      console.warn('Error parsing directions query params:', e);
    }
  }

  // Pattern 2: Path-based /dir/Stop1/Stop2/Stop3/...
  const dir_match = input.match(/\/dir\/([^?#]+)/);
  if (dir_match) {
    const full_path = dir_match[1];
    const raw_segments = full_path
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    const cleaned_stops = [];

    for (const seg of raw_segments) {
      if (seg.startsWith('@') || seg.startsWith('data=') || seg.startsWith('am=')) continue;
      const decoded = decodeURIComponent(seg.replace(/\+/g, ' '));
      if (!decoded) continue;

      const coord_match = decoded.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
      let lat = undefined;
      let lng = undefined;
      if (coord_match) {
        lat = parseFloat(coord_match[1]);
        lng = parseFloat(coord_match[2]);
      }

      cleaned_stops.push({
        id: `dest_dir_${Date.now()}_${cleaned_stops.length}`,
        name: decoded,
        address: decoded,
        latitude: lat,
        longitude: lng,
      });
    }

    if (cleaned_stops.length > 0) {
      return {
        is_directions: true,
        destinations: cleaned_stops,
        travel_mode: 'driving',
        location_name: `Route: ${cleaned_stops[0]?.name} → ${cleaned_stops[cleaned_stops.length - 1]?.name}`,
      };
    }
  }

  return null;
}

/**
 * Universal Google Maps URL & Coordinates Parser
 */
export function parse_google_maps_url(raw_input) {
  if (!raw_input || typeof raw_input !== 'string') return null;
  const input = raw_input.trim();
  if (!input) return null;

  // 1. Check for Google Maps Directions / Multi-Destination URLs first
  if (input.includes('/dir/') || input.includes('origin=') || input.includes('waypoints=')) {
    const directions_parsed = parse_google_maps_directions_url(input);
    if (directions_parsed) return directions_parsed;
  }

  let latitude = null;
  let longitude = null;
  let zoom = 15;
  let place_name = null;
  let address = null;

  // 2. Try extracting exact pin from protobuf data !3d... !4d...
  const proto_lat_match = input.match(/!3d(-?\d+\.\d+)/);
  const proto_lng_match = input.match(/!4d(-?\d+\.\d+)/);
  if (proto_lat_match && proto_lng_match) {
    latitude = parseFloat(proto_lat_match[1]);
    longitude = parseFloat(proto_lng_match[1]);
  }

  // 3. Try viewport center and zoom from @lat,lng,zoomz
  const at_match = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)(?:,(\d+(?:\.\d+)?)z)?/);
  if (at_match) {
    if (latitude === null || longitude === null) {
      latitude = parseFloat(at_match[1]);
      longitude = parseFloat(at_match[2]);
    }
    if (at_match[3]) {
      zoom = Math.round(parseFloat(at_match[3]));
    }
  }

  // 4. Try query parameters like query=lat,lng or q=lat,lng or ll=lat,lng
  if (latitude === null || longitude === null) {
    const q_coords_match = input.match(/(?:query|q|ll)=(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    if (q_coords_match) {
      latitude = parseFloat(q_coords_match[1]);
      longitude = parseFloat(q_coords_match[2]);
    }
  }

  // 5. Try raw coordinates like "35.6585, 139.7454"
  if (latitude === null || longitude === null) {
    const raw_match = input.match(/^(-?\d+\.?\d*)\s*(?:°\s*[NSns])?[,\s]+(-?\d+\.?\d*)\s*(?:°\s*[EWew])?$/);
    if (raw_match) {
      let lat = parseFloat(raw_match[1]);
      let lng = parseFloat(raw_match[2]);
      if (/[Ss]/.test(input)) lat = -Math.abs(lat);
      if (/[Ww]/.test(input)) lng = -Math.abs(lng);
      latitude = lat;
      longitude = lng;
    }
  }

  // 6. Try extracting place name from /place/Place+Name/
  const place_match = input.match(/\/place\/([^/@?]+)/);
  if (place_match) {
    try {
      place_name = decodeURIComponent(place_match[1].replace(/\+/g, ' '));
    } catch (e) {
      place_name = place_match[1].replace(/\+/g, ' ');
    }
  }

  // 7. Try extracting search text
  if (!place_name) {
    const search_match = input.match(/\/search\/([^/@?]+)/);
    if (search_match) {
      try {
        place_name = decodeURIComponent(search_match[1].replace(/\+/g, ' '));
      } catch (e) {
        place_name = search_match[1].replace(/\+/g, ' ');
      }
    }
  }

  if (!place_name) {
    const query_text_match = input.match(/[?&](?:query|q)=([^&]+)/);
    if (query_text_match && !query_text_match[1].match(/^-?\d+\.\d+,-?\d+\.\d+$/)) {
      try {
        place_name = decodeURIComponent(query_text_match[1].replace(/\+/g, ' '));
      } catch (e) {
        place_name = query_text_match[1].replace(/\+/g, ' ');
      }
    }
  }

  if (place_name && place_name.includes(',')) {
    const parts = place_name.split(',');
    place_name = parts[0].trim();
    address = parts.slice(1).join(',').trim();
  } else if (place_name) {
    address = place_name;
  }

  if (latitude !== null && longitude !== null) {
    zoom = Math.max(3, Math.min(19, zoom || 15));
    return {
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      zoom,
      location_name: place_name || `${latitude >= 0 ? latitude.toFixed(4) + '°N' : Math.abs(latitude).toFixed(4) + '°S'}, ${longitude >= 0 ? longitude.toFixed(4) + '°E' : Math.abs(longitude).toFixed(4) + '°W'}`,
      address: address || `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
    };
  }

  if (place_name) {
    return {
      location_name: place_name,
      address: address || place_name,
      zoom: 15,
    };
  }

  return null;
}

/**
 * Resolves short links (maps.app.goo.gl, etc.) and parses coordinates or directions
 */
export async function resolve_and_parse_gmap_url(raw_input) {
  if (!raw_input || typeof raw_input !== 'string') return null;
  const input = raw_input.trim();
  if (!input) return null;

  // 1. Direct client-side parsing
  const client_parsed = parse_google_maps_url(input);
  if (client_parsed) {
    if (client_parsed.is_directions || (client_parsed.latitude !== undefined && client_parsed.longitude !== undefined)) {
      return client_parsed;
    }
  }

  // 2. If it's a short link or redirect URL, resolve via backend
  if (input.includes('goo.gl') || input.includes('maps.app') || input.includes('bit.ly') || input.startsWith('http')) {
    try {
      const res = await fetch('/api/geo/resolve-gmap-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: input }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.resolved_url && data.resolved_url !== input) {
          const resolved_parsed = parse_google_maps_url(data.resolved_url);
          if (resolved_parsed) return resolved_parsed;
        }
      }
    } catch (e) {
      console.warn('Could not resolve short link via server:', e);
    }
  }

  return client_parsed;
}

export default function LUMEN_geo_card({ card }) {
  useSignals();

  const [is_copied, set_is_copied] = useState(false);
  const [is_more_open, set_is_more_open] = useState(false);
  const [is_interactive, set_is_interactive] = useState(false);
  const [view_mode, set_view_mode] = useState('map'); // 'map' | 'itinerary'
  const [gmap_url_input, set_gmap_url_input] = useState('');
  const [is_resolving, set_is_resolving] = useState(false);
  const [place_suggestions, set_place_suggestions] = useState([]);
  const [is_searching_places, set_is_searching_places] = useState(false);

  const card_search_timer_ref = useRef(null);
  const card_search_id_ref = useRef(0);

  useEffect(() => {
    return () => {
      if (card_search_timer_ref.current) {
        clearTimeout(card_search_timer_ref.current);
      }
    };
  }, []);

  const destinations = normalize_card_destinations(card);
  const is_multi_stop = destinations.length > 1;
  const travel_mode = card.travel_mode || 'driving';
  const total_distance_str = calculate_total_route_distance(destinations);
  const current_travel_mode_obj = TRAVEL_MODES.find((m) => m.id === travel_mode) || TRAVEL_MODES[0];

  const primary_dest = destinations[0] || {};
  const last_dest = destinations[destinations.length - 1] || primary_dest;
  const latitude = typeof primary_dest.latitude === 'number' ? primary_dest.latitude : (card.latitude || 34.9949);
  const longitude = typeof primary_dest.longitude === 'number' ? primary_dest.longitude : (card.longitude || 135.785);
  const zoom = typeof card.zoom === 'number' ? card.zoom : 15;

  const location_name = is_multi_stop
    ? `${primary_dest.name} → ${last_dest.name}`
    : (primary_dest.name || card.location_name || card.title || 'Location Pin');

  const address = is_multi_stop
    ? `${destinations.length} stops route • ${total_distance_str || 'Multi-stop route'}`
    : (primary_dest.address || card.address || `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`);

  // OpenStreetMap Bounding Box
  const bbox_info = compute_destinations_bbox(destinations, zoom);
  const osm_embed_url = bbox_info.osm_embed_url;

  // External Multi-Destination URLs
  const google_maps_url = build_google_maps_directions_url(destinations, travel_mode);
  const apple_maps_url = build_apple_maps_directions_url(destinations);
  const osm_url = build_osm_directions_url(destinations);
  const waze_url = `https://waze.com/ul?ll=${(last_dest.latitude || latitude)},${(last_dest.longitude || longitude)}&navigate=yes`;

  // Formatted coordinate strings for primary stop
  const formatted_lat = latitude >= 0 ? `${latitude.toFixed(4)}°N` : `${Math.abs(latitude).toFixed(4)}°S`;
  const formatted_lng = longitude >= 0 ? `${longitude.toFixed(4)}°E` : `${Math.abs(longitude).toFixed(4)}°W`;
  const coords_string = `${formatted_lat}, ${formatted_lng}`;

  const handle_copy_route_link = (e) => {
    if (e) e.stopPropagation();
    navigator.clipboard?.writeText(google_maps_url).then(() => {
      set_is_copied(true);
      showToast(`Copied Google Maps ${is_multi_stop ? 'Route' : 'Location'} link!`);
      setTimeout(() => set_is_copied(false), 2000);
    }).catch(() => {
      showToast(google_maps_url);
    });
  };

  const handle_zoom_change = (deltaZoom, e) => {
    if (e) e.stopPropagation();
    const new_zoom = Math.max(3, Math.min(19, zoom + deltaZoom));
    updateCard(card.id, { zoom: new_zoom }, true);
    saveCurrentBoardToStore();
  };

  const handle_set_travel_mode = (mode_id, e) => {
    if (e) e.stopPropagation();
    updateCard(card.id, { travel_mode: mode_id }, true);
    saveCurrentBoardToStore();
    const modeObj = TRAVEL_MODES.find((m) => m.id === mode_id);
    showToast(`Google Maps Mode: ${modeObj?.emoji} ${modeObj?.label}`);
  };

  const handle_add_destination = (new_dest) => {
    const updated = [...destinations, new_dest];
    updateCard(
      card.id,
      {
        destinations: updated,
        latitude: updated[0]?.latitude ?? card.latitude,
        longitude: updated[0]?.longitude ?? card.longitude,
        location_name: updated.length > 1 ? `Route: ${updated[0].name} → ${updated[updated.length - 1].name}` : updated[0].name,
        title: updated.length > 1 ? `Route: ${updated[0].name} → ${updated[updated.length - 1].name}` : updated[0].name,
      },
      true
    );
    saveCurrentBoardToStore();
    showToast(`Added stop: "${new_dest.name}" (${updated.length} total stops)`);
  };

  const handle_remove_destination = (index, e) => {
    if (e) e.stopPropagation();
    if (destinations.length <= 1) {
      showToast('A route must have at least one destination.');
      return;
    }
    const updated = destinations.filter((_, idx) => idx !== index);
    updateCard(
      card.id,
      {
        destinations: updated,
        latitude: updated[0]?.latitude ?? card.latitude,
        longitude: updated[0]?.longitude ?? card.longitude,
        location_name: updated.length > 1 ? `Route: ${updated[0].name} → ${updated[updated.length - 1].name}` : updated[0].name,
        title: updated.length > 1 ? `Route: ${updated[0].name} → ${updated[updated.length - 1].name}` : updated[0].name,
      },
      true
    );
    saveCurrentBoardToStore();
    showToast(`Removed stop. (${updated.length} remaining)`);
  };

  const handle_move_destination = (from_idx, direction, e) => {
    if (e) e.stopPropagation();
    const to_idx = from_idx + direction;
    if (to_idx < 0 || to_idx >= destinations.length) return;
    const updated = [...destinations];
    const temp = updated[from_idx];
    updated[from_idx] = updated[to_idx];
    updated[to_idx] = temp;
    updateCard(
      card.id,
      {
        destinations: updated,
        latitude: updated[0]?.latitude ?? card.latitude,
        longitude: updated[0]?.longitude ?? card.longitude,
        location_name: updated.length > 1 ? `Route: ${updated[0].name} → ${updated[updated.length - 1].name}` : updated[0].name,
        title: updated.length > 1 ? `Route: ${updated[0].name} → ${updated[updated.length - 1].name}` : updated[0].name,
      },
      true
    );
    saveCurrentBoardToStore();
    showToast('Reordered stops in Google Maps route');
  };

  const handle_reverse_route = (e) => {
    if (e) e.stopPropagation();
    if (destinations.length < 2) return;
    const updated = [...destinations].reverse();
    updateCard(
      card.id,
      {
        destinations: updated,
        latitude: updated[0]?.latitude ?? card.latitude,
        longitude: updated[0]?.longitude ?? card.longitude,
        location_name: `Route: ${updated[0].name} → ${updated[updated.length - 1].name}`,
        title: `Route: ${updated[0].name} → ${updated[updated.length - 1].name}`,
      },
      true
    );
    saveCurrentBoardToStore();
    showToast('Reversed route direction (Origin ↔ Destination)');
  };

  const handle_process_gmap_url = async (raw_input) => {
    const input_text = (raw_input !== undefined ? raw_input : gmap_url_input).trim();
    if (!input_text) return;

    set_is_resolving(true);
    try {
      const parsed = await resolve_and_parse_gmap_url(input_text);
      if (parsed) {
        if (parsed.is_directions && Array.isArray(parsed.destinations) && parsed.destinations.length > 0) {
          // It's a full multi-destination Google Maps route!
          updateCard(
            card.id,
            {
              url: input_text,
              destinations: parsed.destinations,
              travel_mode: parsed.travel_mode || travel_mode,
              latitude: parsed.destinations[0]?.latitude ?? card.latitude,
              longitude: parsed.destinations[0]?.longitude ?? card.longitude,
              location_name: parsed.location_name || `Route (${parsed.destinations.length} Stops)`,
              title: parsed.location_name || `Route (${parsed.destinations.length} Stops)`,
              address: `${parsed.destinations.length} stops route`,
            },
            true
          );
          saveCurrentBoardToStore();
          showToast(`Imported ${parsed.destinations.length} Google Maps destinations!`);
          set_gmap_url_input('');
        } else {
          // Single destination parsed
          const new_dest = {
            id: `dest_parsed_${Date.now()}`,
            name: parsed.location_name || input_text,
            address: parsed.address || input_text,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
          };
          if (destinations.length <= 1 && view_mode !== 'itinerary') {
            updateCard(
              card.id,
              {
                url: input_text,
                destinations: [new_dest],
                location_name: new_dest.name,
                title: new_dest.name,
                address: new_dest.address,
                latitude: new_dest.latitude ?? card.latitude,
                longitude: new_dest.longitude ?? card.longitude,
                zoom: parsed.zoom || 15,
              },
              true
            );
            saveCurrentBoardToStore();
            showToast(`Location set to "${new_dest.name}"!`);
            set_gmap_url_input('');
          } else {
            handle_add_destination(new_dest);
            set_gmap_url_input('');
          }
        }
      } else {
        // Plain text query: resolve coordinates using search places API
        let search_dest = null;
        try {
          const search_results = await api_search_places(input_text);
          if (Array.isArray(search_results) && search_results.length > 0) {
            const top_place = search_results[0];
            search_dest = {
              id: `dest_search_${Date.now()}`,
              name: top_place.name || input_text,
              address: top_place.address || top_place.display_name || input_text,
              latitude: top_place.latitude,
              longitude: top_place.longitude,
            };
          }
        } catch (err_search) {
          console.warn('Could not search place coordinates:', err_search);
        }

        const new_dest = search_dest || {
          id: `dest_text_${Date.now()}`,
          name: input_text,
          address: input_text,
        };

        const gmap_query_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((new_dest.name || '') + ' ' + (new_dest.address || ''))}`;

        if (destinations.length <= 1 && view_mode !== 'itinerary') {
          updateCard(
            card.id,
            {
              url: gmap_query_url,
              destinations: [new_dest],
              location_name: new_dest.name,
              title: new_dest.name,
              address: new_dest.address,
              latitude: new_dest.latitude ?? card.latitude,
              longitude: new_dest.longitude ?? card.longitude,
            },
            true
          );
          saveCurrentBoardToStore();
          showToast(`Location set to "${new_dest.name}"!`);
          set_gmap_url_input('');
          set_place_suggestions([]);
        } else {
          handle_add_destination(new_dest);
          set_gmap_url_input('');
          set_place_suggestions([]);
        }
      }
    } catch (err) {
      showToast('Error parsing Google Maps destination');
    } finally {
      set_is_resolving(false);
    }
  };

  const handle_select_suggestion = (suggestion) => {
    const new_dest = {
      id: `dest_suggest_${Date.now()}`,
      name: suggestion.name,
      address: suggestion.address || suggestion.display_name || suggestion.name,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    };
    const gmap_query_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(new_dest.name + ' ' + (new_dest.address || ''))}`;

    if (destinations.length <= 1 && view_mode !== 'itinerary') {
      updateCard(
        card.id,
        {
          url: gmap_query_url,
          destinations: [new_dest],
          location_name: new_dest.name,
          title: new_dest.name,
          address: new_dest.address,
          latitude: new_dest.latitude,
          longitude: new_dest.longitude,
        },
        true
      );
      saveCurrentBoardToStore();
      showToast(`Location set to "${new_dest.name}"!`);
    } else {
      handle_add_destination(new_dest);
    }
    set_gmap_url_input('');
    set_place_suggestions([]);
  };

  const handle_input_change = (e) => {
    const val = e.target.value;
    set_gmap_url_input(val);
    const trimmed = val.trim();
    if (trimmed.length >= 2 && !trimmed.startsWith('http') && !trimmed.includes('maps.app')) {
      if (card_search_timer_ref.current) {
        clearTimeout(card_search_timer_ref.current);
      }

      const req_id = ++card_search_id_ref.current;
      set_is_searching_places(true);

      card_search_timer_ref.current = setTimeout(async () => {
        try {
          const results = await api_search_places(trimmed);
          if (req_id === card_search_id_ref.current) {
            set_place_suggestions((results || []).slice(0, 6));
          }
        } catch (err) {
          if (req_id === card_search_id_ref.current) {
            set_place_suggestions([]);
          }
        } finally {
          if (req_id === card_search_id_ref.current) {
            set_is_searching_places(false);
          }
        }
      }, 200);
    } else {
      if (card_search_timer_ref.current) {
        clearTimeout(card_search_timer_ref.current);
      }
      set_place_suggestions([]);
      set_is_searching_places(false);
    }
  };

  const handle_paste_from_clipboard = async (e) => {
    if (e) e.stopPropagation();
    try {
      const text = await navigator.clipboard?.readText();
      if (text && text.trim()) {
        const trimmed = text.trim();
        set_gmap_url_input(trimmed);
        handle_process_gmap_url(trimmed);
      }
    } catch (err) {
      showToast('Paste Google Maps link into the input field');
    }
  };

  const handle_submit_input = (e) => {
    if (e) e.preventDefault();
    handle_process_gmap_url(gmap_url_input);
  };

  return (
    <div className={styles['lumen-geo-card']}>
      {/* Location Header Info */}
      <div className={styles['lumen-geo-header']}>
        <div className={styles['lumen-geo-header-left']}>
          <div
            className={`${styles['lumen-geo-icon-wrap']} ${is_multi_stop ? styles['lumen-geo-icon-wrap-multi'] : ''}`}
            title={is_multi_stop ? `Google Maps Multi-Destination Route (${destinations.length} stops)` : 'Geographic Location Pin'}
          >
            {is_multi_stop ? <Route size={16} /> : <MapPin size={16} />}
          </div>

          <div className={styles['lumen-geo-titles']}>
            <div className={styles['lumen-geo-title-row']}>
              <span className={styles['lumen-geo-place-name']} title={location_name}>
                {location_name}
              </span>
              {is_multi_stop && (
                <span className={styles['lumen-geo-stop-count-pill']}>
                  {destinations.length} Stops
                </span>
              )}
            </div>
            <span className={styles['lumen-geo-address']} title={address}>
              {address}
            </span>
          </div>
        </div>

        {/* View Mode Toggle: Map vs Itinerary Stops */}
        <div className={styles['lumen-geo-header-actions']}>
          <button
            type="button"
            className={`${styles['lumen-geo-view-toggle-btn']} ${view_mode === 'itinerary' ? styles['lumen-geo-view-toggle-active'] : ''}`}
            onClick={() => set_view_mode(view_mode === 'map' ? 'itinerary' : 'map')}
            title={view_mode === 'map' ? `View & Edit ${destinations.length} Stops Itinerary` : 'Return to Interactive Map View'}
          >
            {view_mode === 'map' ? (
              <>
                <Milestone size={11} />
                <span>Stops ({destinations.length})</span>
              </>
            ) : (
              <>
                <MapPin size={11} />
                <span>Map View</span>
              </>
            )}
          </button>

          {/* Copy Google Maps Route / GPS Link Badge */}
          <button
            type="button"
            className={styles['lumen-geo-coords-badge']}
            onClick={handle_copy_route_link}
            title={is_multi_stop ? 'Copy Google Maps Multi-Destination directions link' : 'Copy GPS coordinates'}
          >
            {is_copied ? <Check size={10} color="#059669" /> : <Copy size={10} />}
            <span>{is_multi_stop ? 'Copy Route' : coords_string}</span>
          </button>
        </div>
      </div>

      {/* Main Card Body: Map View OR Itinerary View */}
      {view_mode === 'map' ? (
        <div className={styles['lumen-geo-map-frame']}>
          {/* OpenStreetMap interactive render fitting all route destinations */}
          <iframe
            title={`Map preview of ${location_name}`}
            className={styles['lumen-geo-iframe']}
            src={osm_embed_url}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />

          {/* Lock overlay: protects card dragging from getting trapped in map iframe unless toggled */}
          <div
            className={`${styles['lumen-geo-map-lock-overlay']} ${
              is_interactive ? styles['lumen-geo-map-lock-overlay-disabled'] : ''
            }`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              set_is_interactive(!is_interactive);
            }}
            title={is_interactive ? 'Map interactive. Double-click to lock card drag.' : 'Double-click map to interactively zoom/pan inside preview'}
          />

          {/* Multi-Destination Route Ribbon Overlay */}
          {is_multi_stop && (
            <div className={styles['lumen-geo-route-ribbon']} onClick={(e) => e.stopPropagation()}>
              <div className={styles['lumen-geo-ribbon-stops']}>
                {destinations.map((d, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const is_first = idx === 0;
                  const is_last = idx === destinations.length - 1;
                  return (
                    <div key={d.id || idx} className={styles['lumen-geo-ribbon-chip-wrap']}>
                      <span
                        className={`${styles['lumen-geo-ribbon-chip']} ${
                          is_first
                            ? styles['lumen-geo-chip-origin']
                            : is_last
                            ? styles['lumen-geo-chip-dest']
                            : styles['lumen-geo-chip-mid']
                        }`}
                        title={`${letter}: ${d.name}\n${d.address || ''}`}
                      >
                        <strong className={styles['lumen-geo-ribbon-letter']}>{letter}</strong>
                        <span className={styles['lumen-geo-ribbon-name']}>{d.name.split(',')[0]}</span>
                      </span>
                      {!is_last && <span className={styles['lumen-geo-ribbon-arrow']}>→</span>}
                    </div>
                  );
                })}
              </div>

              {/* Quick Travel Mode Selector Chips */}
              <div className={styles['lumen-geo-ribbon-modes']}>
                {TRAVEL_MODES.map((m) => {
                  const is_active = travel_mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`${styles['lumen-geo-ribbon-mode-btn']} ${is_active ? styles['lumen-geo-ribbon-mode-active'] : ''}`}
                      onClick={(e) => handle_set_travel_mode(m.id, e)}
                      title={`Google Maps Mode: ${m.label}`}
                    >
                      <span>{m.emoji}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Map Floating Controls */}
          <div className={styles['lumen-geo-map-controls']} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`${styles['lumen-geo-ctrl-btn']} ${is_interactive ? styles['lumen-geo-ctrl-btn-active'] : ''}`}
              onClick={() => set_is_interactive(!is_interactive)}
              title={is_interactive ? 'Lock map interactions (enables card drag)' : 'Unlock map interactions (pan & scroll inside map)'}
            >
              {is_interactive ? <Unlock size={11} /> : <Lock size={11} />}
            </button>

            <button
              type="button"
              className={styles['lumen-geo-ctrl-btn']}
              onClick={(e) => handle_zoom_change(1, e)}
              title="Zoom In (+)"
            >
              <ZoomIn size={11} />
            </button>

            <button
              type="button"
              className={styles['lumen-geo-ctrl-btn']}
              onClick={(e) => handle_zoom_change(-1, e)}
              title="Zoom Out (-)"
            >
              <ZoomOut size={11} />
            </button>
          </div>
        </div>
      ) : (
        /* Itinerary / Multi-Destination Stops Management View */
        <div className={styles['lumen-geo-itinerary-frame']} onClick={(e) => e.stopPropagation()}>
          <div className={styles['lumen-geo-itinerary-header']}>
            <div className={styles['lumen-geo-itinerary-title']}>
              <Route size={13} color="var(--lumen-accent)" />
              <span>Google Maps Multi-Destination Route</span>
            </div>

            {is_multi_stop && (
              <button
                type="button"
                className={styles['lumen-geo-reverse-btn']}
                onClick={handle_reverse_route}
                title="Reverse Route (Origin ↔ Destination)"
              >
                <ArrowUpDown size={11} />
                <span>Reverse</span>
              </button>
            )}
          </div>

          {/* Travel Mode Selector Bar */}
          <div className={styles['lumen-geo-travel-mode-row']}>
            <span className={styles['lumen-geo-travel-mode-label']}>Mode:</span>
            {TRAVEL_MODES.map((m) => {
              const is_active = travel_mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`${styles['lumen-geo-mode-chip']} ${is_active ? styles['lumen-geo-mode-chip-active'] : ''}`}
                  onClick={(e) => handle_set_travel_mode(m.id, e)}
                  title={`Calculate route for ${m.label}`}
                >
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Stops List */}
          <div className={styles['lumen-geo-stops-list']}>
            {destinations.map((dest, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const is_first = idx === 0;
              const is_last = idx === destinations.length - 1;

              return (
                <div key={dest.id || idx} className={styles['lumen-geo-stop-card']}>
                  <div
                    className={`${styles['lumen-geo-stop-letter']} ${
                      is_first
                        ? styles['lumen-geo-letter-origin']
                        : is_last
                        ? styles['lumen-geo-letter-dest']
                        : styles['lumen-geo-letter-mid']
                    }`}
                  >
                    {letter}
                  </div>

                  <div className={styles['lumen-geo-stop-info']}>
                    <span className={styles['lumen-geo-stop-name']}>
                      {dest.name}
                    </span>
                    {dest.address && dest.address !== dest.name && (
                      <span className={styles['lumen-geo-stop-addr']}>
                        {dest.address}
                      </span>
                    )}
                    {typeof dest.latitude === 'number' && typeof dest.longitude === 'number' && (
                      <span className={styles['lumen-geo-stop-coords']}>
                        {dest.latitude.toFixed(4)}°, {dest.longitude.toFixed(4)}°
                      </span>
                    )}
                  </div>

                  <div className={styles['lumen-geo-stop-actions']}>
                    <button
                      type="button"
                      className={styles['lumen-geo-order-btn']}
                      disabled={is_first}
                      onClick={(e) => handle_move_destination(idx, -1, e)}
                      title="Move Stop Up in Route"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      type="button"
                      className={styles['lumen-geo-order-btn']}
                      disabled={is_last}
                      onClick={(e) => handle_move_destination(idx, 1, e)}
                      title="Move Stop Down in Route"
                    >
                      <ChevronDown size={12} />
                    </button>
                    {destinations.length > 1 && (
                      <button
                        type="button"
                        className={styles['lumen-geo-remove-stop-btn']}
                        onClick={(e) => handle_remove_destination(idx, e)}
                        title="Remove Stop from Route"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Bar: Google Maps Multiple Destination Launcher & Quick Adder */}
      <div className={styles['lumen-geo-actions']} onClick={(e) => e.stopPropagation()}>
        {/* Google Maps URL & New Stop Input Form */}
        <form onSubmit={handle_submit_input} className={styles['lumen-geo-url-form']}>
          <div className={styles['lumen-geo-url-input-wrap']}>
            <Navigation size={12} className={styles['lumen-geo-url-icon']} />
            <input
              type="text"
              className={styles['lumen-geo-url-input']}
              placeholder={is_multi_stop ? "Add stop: paste Google Maps link or place..." : "Paste Google Maps URL or search place..."}
              value={gmap_url_input}
              onChange={handle_input_change}
              onFocus={(e) => e.target.select()}
            />
            {gmap_url_input ? (
              <button
                type="button"
                className={styles['lumen-geo-url-clear-btn']}
                onClick={() => {
                  set_gmap_url_input('');
                  set_place_suggestions([]);
                }}
                title="Clear input"
              >
                <X size={11} />
              </button>
            ) : (
              <button
                type="button"
                className={styles['lumen-geo-url-paste-btn']}
                onClick={handle_paste_from_clipboard}
                title="Paste Google Maps URL from clipboard"
              >
                Paste
              </button>
            )}

            {/* Places Search Autocomplete Suggestions Dropdown */}
            {place_suggestions.length > 0 && (
              <div className={styles['lumen-geo-search-dropdown']}>
                {place_suggestions.map((p, p_idx) => (
                  <button
                    key={p.place_id || p_idx}
                    type="button"
                    className={styles['lumen-geo-search-dropdown-item']}
                    onClick={() => handle_select_suggestion(p)}
                  >
                    <MapPin size={11} color="var(--lumen-accent)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div className={styles['lumen-geo-search-dropdown-text']}>
                      <span className={styles['lumen-geo-search-dropdown-name']}>{p.name}</span>
                      <span className={styles['lumen-geo-search-dropdown-addr']}>{p.address || p.display_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="submit"
            className={styles['lumen-geo-url-apply-btn']}
            disabled={!gmap_url_input.trim() || is_resolving}
            title={is_multi_stop ? "Add destination to Google Maps route" : "Apply Google Maps location"}
          >
            {is_resolving ? 'Loading...' : (is_multi_stop ? '+ Stop' : 'Apply')}
          </button>
        </form>

        {/* Primary Action Button: Open in Google Maps (Full Multiple Destination Route) */}
        <a
          href={google_maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles['lumen-geo-primary-route-btn']}
          title={`Open full ${is_multi_stop ? `${destinations.length}-stop route` : 'location'} in Google Maps with ${current_travel_mode_obj.label} navigation`}
        >
          <Navigation size={13} color="#ffffff" />
          <span className={styles['lumen-geo-primary-btn-text']}>
            {is_multi_stop ? (
              <>
                Open in Google Maps (<strong>{destinations.length} Stops</strong> • {current_travel_mode_obj.emoji})
              </>
            ) : (
              'Open in Google Maps'
            )}
          </span>
          <ExternalLink size={11} color="#ffffff" opacity={0.8} />
        </a>

        {/* Secondary Map Provider Launchers */}
        <div className={styles['lumen-geo-providers-row']}>
          <span className={styles['lumen-geo-providers-label']}>
            Also:
          </span>

          {/* Apple Maps */}
          <a
            href={apple_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles['lumen-geo-provider-chip']} ${styles['lumen-geo-chip-apple']}`}
            title="Open directions in Apple Maps"
          >
            <span>Apple Maps</span>
            <ExternalLink size={9} opacity={0.7} />
          </a>

          {/* Waze */}
          <a
            href={waze_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles['lumen-geo-provider-chip']} ${styles['lumen-geo-chip-waze']}`}
            title="Navigate in Waze"
          >
            <Compass size={11} color="#0d9488" />
            <span>Waze</span>
            <ExternalLink size={9} opacity={0.7} />
          </a>

          {/* OpenStreetMap */}
          <a
            href={osm_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles['lumen-geo-provider-chip']} ${styles['lumen-geo-chip-osm']}`}
            title="Open route in OpenStreetMap"
          >
            <Globe size={11} color="#15803d" />
            <span>OSM Route</span>
            <ExternalLink size={9} opacity={0.7} />
          </a>

          {/* More Actions Dropdown Toggle */}
          <button
            type="button"
            className={styles['lumen-geo-more-btn']}
            onClick={() => set_is_more_open(!is_more_open)}
            title="More routing options"
          >
            <span>Options</span>
            <ChevronDown size={11} />
          </button>
        </div>

        {/* Dropdown for Route Utilities */}
        {is_more_open && (
          <div className={styles['lumen-geo-dropdown']} onClick={(e) => e.stopPropagation()}>
            {/* Copy Full Route Link */}
            <button
              type="button"
              className={styles['lumen-geo-dropdown-item']}
              onClick={() => {
                handle_copy_route_link();
                set_is_more_open(false);
              }}
            >
              <Copy size={12} />
              <span>Copy Google Maps Route URL</span>
            </button>

            {/* Reverse Route */}
            {is_multi_stop && (
              <button
                type="button"
                className={styles['lumen-geo-dropdown-item']}
                onClick={(e) => {
                  handle_reverse_route(e);
                  set_is_more_open(false);
                }}
              >
                <ArrowUpDown size={12} />
                <span>Reverse Route Stops</span>
              </button>
            )}

            {/* Toggle View Mode */}
            <button
              type="button"
              className={styles['lumen-geo-dropdown-item']}
              onClick={() => {
                set_view_mode(view_mode === 'map' ? 'itinerary' : 'map');
                set_is_more_open(false);
              }}
            >
              {view_mode === 'map' ? <Milestone size={12} /> : <MapPin size={12} />}
              <span>{view_mode === 'map' ? 'Edit Stops Itinerary' : 'View Map'}</span>
            </button>
          </div>
        )}

        {/* Location / Route Notes */}
        {card.notes && (
          <div className={styles['lumen-geo-notes']} title={card.notes}>
            {card.notes}
          </div>
        )}
      </div>
    </div>
  );
}
