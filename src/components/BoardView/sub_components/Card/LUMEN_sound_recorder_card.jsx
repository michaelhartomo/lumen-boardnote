import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Mic,
  Square,
  Upload,
  Sparkles,
  Languages,
  Loader2,
  AlertCircle,
  Download,
  Trash2,
  CheckCircle2,
  Volume2,
  VolumeX,
  Cloud,
  Users,
  ArrowLeftRight,
  Send,
  FileText,
  UserPlus,
  Clock,
  X,
} from 'lucide-react';
import {
  updateCard,
  saveCurrentBoardToStore,
  activeBoardSignal,
  get_lumen_auth_headers,
  upload_lumen_file,
  delete_storage_file_for_board_item,
  showToast,
} from '../../signals/boardState.js';
import {
  runAiCardAction,
  getSelectedAiModelForTask,
  formatAiElapsedTime,
  showAiErrorModal,
} from '../../signals/aiState.js';
import styles from './LUMEN_sound_recorder_card.module.css';

const LUMEN_SUPPORTED_LANGUAGES = [
  'English',
  'Indonesian',
  'Spanish',
  'French',
  'German',
  'Japanese',
  'Korean',
  'Mandarin Chinese',
  'Chinese (Simplified)',
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

const LUMEN_PARTICIPANT_LANGUAGE_OPTIONS = [
  'Auto-Detect',
  ...LUMEN_SUPPORTED_LANGUAGES,
];

const LUMEN_SPEAKER_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];

const LUMEN_LANG_BCP47 = {
  'Auto-Detect': '',
  English: 'en-US',
  Indonesian: 'id-ID',
  Spanish: 'es-ES',
  French: 'fr-FR',
  German: 'de-DE',
  Japanese: 'ja-JP',
  Korean: 'ko-KR',
  'Mandarin Chinese': 'zh-CN',
  'Chinese (Simplified)': 'zh-CN',
  Arabic: 'ar-SA',
  Portuguese: 'pt-BR',
  Russian: 'ru-RU',
  Hindi: 'hi-IN',
  Italian: 'it-IT',
  Dutch: 'nl-NL',
  Turkish: 'tr-TR',
  Vietnamese: 'vi-VN',
  Thai: 'th-TH',
  Tagalog: 'tl-PH',
  Malay: 'ms-MY',
  Polish: 'pl-PL',
};

function build_default_meeting_participants(card) {
  if (
    Array.isArray(card?.meeting_participants) &&
    card.meeting_participants.length >= 2
  ) {
    return card.meeting_participants.map((p, idx) => {
      const letter = LUMEN_SPEAKER_LETTERS[idx] || String(idx + 1);
      return {
        id: p?.id || `speaker_${letter}`,
        name:
          String(p?.name || '').trim() ||
          `Person ${String.fromCharCode(65 + idx)}`,
        lang: String(p?.lang || 'Auto-Detect').trim() || 'Auto-Detect',
      };
    });
  }
  return [
    {
      id: 'speaker_a',
      name: card?.speaker_a_name || 'Person A',
      lang: card?.speaker_a_lang || 'Auto-Detect',
    },
    {
      id: 'speaker_b',
      name: card?.speaker_b_name || 'Person B',
      lang: card?.speaker_b_lang || 'Auto-Detect',
    },
  ];
}

function get_speaker_letter_suffix(speaker_id, index = 0) {
  const clean = String(speaker_id || '').toLowerCase();
  for (const letter of LUMEN_SPEAKER_LETTERS) {
    if (clean === `speaker_${letter}` || clean.endsWith(`_${letter}`)) {
      return letter;
    }
  }
  return LUMEN_SPEAKER_LETTERS[index % LUMEN_SPEAKER_LETTERS.length] || 'a';
}

function blob_to_base64_data_url(blob) {
  return new Promise((resolve) => {
    if (!blob) {
      resolve('');
      return;
    }
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(typeof reader.result === 'string' ? reader.result : '');
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    } catch {
      resolve('');
    }
  });
}

function speak_translated_utterance(text, language_name) {
  const clean_str = String(text || '').trim();
  if (!clean_str || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(clean_str);
    utterance.lang = LUMEN_LANG_BCP47[language_name] || 'en-US';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch {
    // ignore speech synthesis error
  }
}

const LUMEN_WAVE_BAR_COUNT = 24;

function format_duration_mm_ss(total_seconds) {
  const safe_sec = Math.max(0, Math.floor(Number(total_seconds) || 0));
  const mins = Math.floor(safe_sec / 60);
  const secs = safe_sec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function ensure_client_timestamped_lines(
  raw_text,
  duration_seconds = 0,
  ref_timestamps = []
) {
  const clean = String(raw_text || '').trim();
  if (!clean) return { formattedText: '', timestamps: [] };

  let lines = clean
    .replace(/\s+(?=\[\d{1,2}:\d{2}\])/g, '\n')
    .replace(/(?<!\[\d{1,2}:\d{2}\])\s+(?=(?:Person|Speaker)\s+[A-F1-6]\s*:)/gi, '\n')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => Boolean(l) && !/^\[\d{1,2}:\d{2}\]$/.test(l));

  if (lines.length === 1) {
    const single = lines[0];
    const has_ts = /^\[\d{1,2}:\d{2}\]/.test(single);
    const stripped = single.replace(/^\[\d{1,2}:\d{2}\]\s*/, '');
    const sentences = stripped
      .split(/(?<=[.!?。！？])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length > 1) {
      lines = sentences.map((s, idx) =>
        idx === 0 && has_ts
          ? `${single.match(/^\[\d{1,2}:\d{2}\]/)?.[0]} ${s}`
          : s
      );
    }
  }

  const total_chars = Math.max(
    1,
    lines.reduce((acc, l) => acc + l.length, 0)
  );
  const effective_total_sec =
    Number(duration_seconds) > 0
      ? Number(duration_seconds)
      : Math.max(3, (lines.length - 1) * 4);

  let cumulative_chars = 0;
  const out_timestamps = [];
  const formatted_lines = lines.map((line, idx) => {
    const match = line.match(
      /^\s*(?:\[\s*(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*\d{2})?\s*\]|\(\s*(\d{1,2})\s*:\s*(\d{2})\s*\)|(\d{1,2}):(\d{2})\s*[-–—:]?)\s*(.*)$/
    );
    if (match) {
      const mm = match[1] || match[3] || match[5] || '00';
      const ss = match[2] || match[4] || match[6] || '00';
      const body = String(match[7] || '').trim();
      const tag =
        ref_timestamps[idx] ||
        `[${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}]`;
      out_timestamps.push(tag);
      cumulative_chars += line.length;
      return `${tag} ${body}`;
    }

    const est_sec =
      idx === 0
        ? 0
        : Math.min(
            Math.max(
              idx,
              Math.round((cumulative_chars / total_chars) * effective_total_sec)
            ),
            Math.max(idx, effective_total_sec)
          );
    const tag = ref_timestamps[idx] || `[${format_duration_mm_ss(est_sec)}]`;
    out_timestamps.push(tag);
    cumulative_chars += line.length;
    return `${tag} ${line}`;
  });

  return {
    formattedText: formatted_lines.join('\n'),
    timestamps: out_timestamps,
  };
}

function parse_timestamped_segments_for_display(raw_text) {
  const clean = String(raw_text || '').trim();
  if (!clean) return [];
  return clean
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const match = line.match(/^\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*(.*)$/);
      if (match) {
        const mins = Number(match[1] || 0);
        const secs = Number(match[2] || 0);
        const total_seconds = mins * 60 + secs;
        return {
          id: `seg_${idx}_${mins}_${secs}`,
          timestampLabel: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
          seconds: total_seconds,
          text: String(match[4] || '').trim(),
        };
      }
      return {
        id: `seg_${idx}_0`,
        timestampLabel: '00:00',
        seconds: 0,
        text: line,
      };
    });
}

function format_audio_bytes(bytes) {
  const num = Number(bytes || 0);
  if (!num || num <= 0) return '';
  if (num < 1024) return `${num} B`;
  const kb = num / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function get_supported_audio_mime_type() {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/wav',
  ];
  for (const mime_type of candidates) {
    try {
      if (
        typeof window.MediaRecorder.isTypeSupported === 'function' &&
        window.MediaRecorder.isTypeSupported(mime_type)
      ) {
        return mime_type;
      }
    } catch {
      // ignore check error
    }
  }
  return '';
}

function get_current_board_id_str() {
  const active_board = activeBoardSignal.value;
  if (!active_board) return null;
  if (typeof active_board === 'string') return active_board;
  return active_board.id || active_board.board_code || null;
}

export default function LUMEN_sound_recorder_card({ card }) {
  useSignals();
  const [recording_status, set_recording_status] = useState('idle'); // 'idle' | 'requesting_permission' | 'recording' | 'uploading'
  const [upload_progress, set_upload_progress] = useState(0);
  const [permission_error, set_permission_error] = useState('');
  const [show_mic_permission_popup, set_show_mic_permission_popup] = useState(false);
  const [pending_live_meeting_start, set_pending_live_meeting_start] = useState(false);
  const has_granted_mic_session_ref = useRef(false);
  const [elapsed_seconds, set_elapsed_seconds] = useState(
    Number(card?.audio_duration || card?.duration_seconds || 0)
  );
  const [wave_levels, set_wave_levels] = useState(() =>
    new Array(LUMEN_WAVE_BAR_COUNT).fill(15)
  );
  const [local_audio_url, set_local_audio_url] = useState('');
  const [local_audio_base64, set_local_audio_base64] = useState(
    () => card?.audio_base64 || ''
  );
  const [pending_audio_blob, set_pending_audio_blob] = useState(null);
  const [is_ai_busy, set_is_ai_busy] = useState(false);
  const [ai_status_text, set_ai_status_text] = useState('');
  const [ai_busy_elapsed_sec, set_ai_busy_elapsed_sec] = useState(0);

  useEffect(() => {
    if (!is_ai_busy) {
      set_ai_busy_elapsed_sec(0);
      return undefined;
    }
    const started_at = Date.now();
    set_ai_busy_elapsed_sec(0);
    const interval_id = window.setInterval(() => {
      set_ai_busy_elapsed_sec(Math.max(0, Math.floor((Date.now() - started_at) / 1000)));
    }, 250);
    return () => {
      window.clearInterval(interval_id);
    };
  }, [is_ai_busy]);

  // Multi-Person Live Transcribe (Muse Voice) states (defaults to 'auto' so multiple speakers are auto-diarized)
  const [active_speaker_role, set_active_speaker_role] = useState('auto'); // 'auto' | 'speaker_a' | 'speaker_b' | 'speaker_c' ...
  const [live_detected_speaker_id, set_live_detected_speaker_id] =
    useState('speaker_a');
  const [detected_speaker_count, set_detected_speaker_count] = useState(
    Number(card?.detected_speaker_count) || 0
  );
  const [detected_speakers_list, set_detected_speakers_list] = useState(
    Array.isArray(card?.detected_speakers) ? card.detected_speakers : []
  );
  const [muse_voice_connected, set_muse_voice_connected] = useState(false);
  const [interim_speech_text, set_interim_speech_text] = useState('');
  const [interim_translated_text, set_interim_translated_text] = useState('');
  const [interim_target_lang, set_interim_target_lang] = useState('');
  const [is_interim_translating, set_is_interim_translating] = useState(false);
  const [last_live_caption, set_last_live_caption] = useState(null);
  const [quick_turn_text, set_quick_turn_text] = useState('');
  const [tts_enabled, set_tts_enabled] = useState(Boolean(card?.tts_enabled));

  // Exact interim source text the displayed interim translation belongs
  // to; guards against pairing new speech with the previous translation.
  const interim_translation_source_ref = useRef('');
  const media_recorder_ref = useRef(null);
  const media_stream_ref = useRef(null);
  const audio_chunks_ref = useRef([]);
  const timer_interval_ref = useRef(null);
  const recording_start_ms_ref = useRef(0);
  const audio_ctx_ref = useRef(null);
  const analyser_ref = useRef(null);
  const anim_frame_ref = useRef(null);
  const file_input_ref = useRef(null);
  const audio_player_ref = useRef(null);

  // Live Transcribe refs for Muse Voice PCM_24KHZ WebSocket streaming, speech recognition & acoustic diarization
  const muse_voice_ws_ref = useRef(null);
  const muse_voice_connected_ref = useRef(false);
  const muse_pcm_ctx_ref = useRef(null);
  const muse_pcm_processor_ref = useRef(null);
  const detected_speaker_labels_set_ref = useRef(new Set());
  const speech_rec_ref = useRef(null);
  const is_live_meeting_active_ref = useRef(false);
  const active_speaker_role_ref = useRef(active_speaker_role);
  const meeting_participants_ref = useRef(build_default_meeting_participants(card));
  const meeting_target_lang_ref = useRef(card?.meeting_target_lang || 'Auto');
  const speaker_a_lang_ref = useRef(card?.speaker_a_lang || 'Auto-Detect');
  const speaker_b_lang_ref = useRef(
    card?.speaker_b_lang || card?.target_language || 'Auto-Detect'
  );
  const speaker_a_name_ref = useRef(card?.speaker_a_name || 'Person A');
  const speaker_b_name_ref = useRef(card?.speaker_b_name || 'Person B');
  const tts_enabled_ref = useRef(tts_enabled);
  const had_voice_activity_ref = useRef(false);
  const last_speech_rec_final_ms_ref = useRef(0);
  const last_muse_ws_transcript_ms_ref = useRef(0);
  const pending_speech_rec_fallback_ref = useRef('');
  const chunk_started_at_ms_ref = useRef(0);
  const chunk_loop_timer_ref = useRef(null);
  const active_chunk_recorder_ref = useRef(null);
  const meeting_feed_ref = useRef(null);
  const meeting_turns_ref = useRef(
    Array.isArray(card?.meeting_turns) ? card.meeting_turns : []
  );

  // Acoustic Voice Diarization refs (differentiates Person A, Person B, Person C even when speaking the same language)
  const utterance_voice_samples_ref = useRef([]);
  const is_currently_speaking_frame_ref = useRef(false);
  const last_voice_active_ms_ref = useRef(0);
  const current_utterance_silence_gap_ms_ref = useRef(0);
  const speaker_voice_profiles_ref = useRef({});
  const last_detected_speaker_id_ref = useRef('speaker_a');

  const recorder_mode = card?.recorder_mode || 'recorder'; // 'recorder' | 'live_meeting'
  const meeting_participants = build_default_meeting_participants(card);
  const meeting_target_lang = card?.meeting_target_lang || 'Auto';
  const speaker_a_name = meeting_participants[0]?.name || 'Person A';
  const speaker_b_name = meeting_participants[1]?.name || 'Person B';
  const speaker_a_lang = meeting_participants[0]?.lang || 'Auto-Detect';
  const speaker_b_lang = meeting_participants[1]?.lang || 'Auto-Detect';
  const meeting_turns = Array.isArray(card?.meeting_turns)
    ? card.meeting_turns
    : [];

  useEffect(() => {
    active_speaker_role_ref.current = active_speaker_role;
    if (
      muse_voice_ws_ref.current &&
      muse_voice_ws_ref.current.readyState === WebSocket.OPEN
    ) {
      try {
        muse_voice_ws_ref.current.send(
          JSON.stringify({
            type: 'config',
            speakerRole: active_speaker_role,
            participants: meeting_participants_ref.current,
            globalTargetLanguage: meeting_target_lang_ref.current,
            fallbackTargetLanguage: card?.target_language || 'Indonesian',
          })
        );
      } catch {
        // ignore ws send error
      }
    }
  }, [active_speaker_role]);

  useEffect(() => {
    meeting_participants_ref.current = meeting_participants;
    meeting_target_lang_ref.current = meeting_target_lang;
    speaker_a_lang_ref.current = speaker_a_lang;
    speaker_b_lang_ref.current = speaker_b_lang;
    speaker_a_name_ref.current = speaker_a_name;
    speaker_b_name_ref.current = speaker_b_name;
    if (
      muse_voice_ws_ref.current &&
      muse_voice_ws_ref.current.readyState === WebSocket.OPEN
    ) {
      try {
        muse_voice_ws_ref.current.send(
          JSON.stringify({
            type: 'config',
            participants: meeting_participants,
            globalTargetLanguage: meeting_target_lang,
            fallbackTargetLanguage: card?.target_language || 'Indonesian',
            speakerRole: active_speaker_role_ref.current,
          })
        );
      } catch {
        // ignore ws send error
      }
    }
  }, [
    meeting_participants,
    meeting_target_lang,
    speaker_a_lang,
    speaker_b_lang,
    speaker_a_name,
    speaker_b_name,
  ]);

  useEffect(() => {
    tts_enabled_ref.current = tts_enabled;
  }, [tts_enabled]);

  useEffect(() => {
    meeting_turns_ref.current = meeting_turns;
    if (meeting_feed_ref.current) {
      meeting_feed_ref.current.scrollTop = 0;
    }
  }, [meeting_turns.length]);

  // Real-time live translation preview while speaking (debounced so live translation updates word-by-word)
  useEffect(() => {
    const clean_interim = String(interim_speech_text || '').trim();
    if (!clean_interim || clean_interim.length < 3) {
      interim_translation_source_ref.current = '';
      set_is_interim_translating(false);
      return undefined;
    }

    // The spoken text moved on: drop the previous phrase's translation
    // immediately so the banner never pairs new speech with it.
    if (interim_translation_source_ref.current !== clean_interim) {
      interim_translation_source_ref.current = clean_interim;
      set_interim_translated_text('');
    }

    let is_cancelled = false;
    const abort_controller =
      typeof window !== 'undefined' && typeof window.AbortController === 'function'
        ? new window.AbortController()
        : null;
    set_is_interim_translating(true);

    const timer_id = setTimeout(async () => {
      try {
        const active_role = active_speaker_role_ref.current || 'auto';
        const detected_id = last_detected_speaker_id_ref.current || 'speaker_a';
        const sound_ai_model = getSelectedAiModelForTask('sound_transcribe');
        const res = await fetch('/api/ai/sound-live-meeting-turn', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...get_lumen_auth_headers(),
          },
          signal: abort_controller ? abort_controller.signal : undefined,
          body: JSON.stringify({
            boardId: get_current_board_id_str(),
            spokenText: clean_interim,
            speakerRole: active_role,
            detectedSpeakerId: detected_id,
            previousSpeakerId: detected_id,
            participants: meeting_participants_ref.current,
            globalTargetLanguage: meeting_target_lang_ref.current,
            fallbackTargetLanguage: card?.target_language || 'Indonesian',
            speakerALang: speaker_a_lang_ref.current,
            speakerBLang: speaker_b_lang_ref.current,
            speakerAName: speaker_a_name_ref.current,
            speakerBName: speaker_b_name_ref.current,
            aiModel: sound_ai_model?.id || 'muse',
            mcpProvider: sound_ai_model?.provider_id || 'muse',
            previewOnly: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!is_cancelled && res.ok && data.ok) {
          const turn_item =
            Array.isArray(data.turns) && data.turns[0] ? data.turns[0] : data;
          if (turn_item?.translatedText) {
            set_interim_translated_text(String(turn_item.translatedText).trim());
          }
          if (turn_item?.targetLanguage) {
            set_interim_target_lang(String(turn_item.targetLanguage).trim());
          }
        }
      } catch {
        // ignore transient or aborted interim preview error
      } finally {
        if (!is_cancelled) {
          set_is_interim_translating(false);
        }
      }
    }, 380);

    return () => {
      is_cancelled = true;
      clearTimeout(timer_id);
      if (abort_controller) {
        try {
          abort_controller.abort();
        } catch {
          // ignore abort error
        }
      }
    };
  }, [interim_speech_text, card?.target_language]);


  const server_view_url =
    card?.view_url ||
    (card?.file_id ? `/api/files/view/${card.file_id}` : '') ||
    card?.file_url ||
    '';
  const server_download_url =
    card?.file_url ||
    (card?.file_id ? `/api/files/download/${card.file_id}` : '') ||
    server_view_url;

  // Prefer server_view_url once uploaded because the server remuxes WebM files to have a finite Matroska duration header
  // (preventing the <audio> progress bar from staying pinned at the end of duration)
  const resolved_audio_src =
    (recording_status === 'uploading' ? local_audio_url : '') ||
    server_view_url ||
    local_audio_url ||
    card?.audio_base64 ||
    local_audio_base64 ||
    '';

  const handle_audio_metadata_duration_fix = (e) => {
    const el = e?.currentTarget || audio_player_ref.current;
    if (!el) return;
    if (el.duration === Infinity || Number.isNaN(el.duration)) {
      el.currentTime = 1e101;
      const reset_to_start = () => {
        el.removeEventListener('timeupdate', reset_to_start);
        el.currentTime = 0;
        if (
          Number.isFinite(el.duration) &&
          el.duration > 0 &&
          !(Number(card?.audio_duration) > 0)
        ) {
          const rounded_dur = Math.max(1, Math.round(el.duration));
          updateCard(
            card.id,
            { audio_duration: rounded_dur, duration_seconds: rounded_dur },
            false
          );
        }
      };
      el.addEventListener('timeupdate', reset_to_start);
    } else if (
      Number.isFinite(el.duration) &&
      el.duration > 0 &&
      !(Number(card?.audio_duration) > 0)
    ) {
      const rounded_dur = Math.max(1, Math.round(el.duration));
      updateCard(
        card.id,
        { audio_duration: rounded_dur, duration_seconds: rounded_dur },
        false
      );
    }
  };

  const target_language = card?.target_language || 'English';
  const transcript_text = card?.transcript || '';
  const translated_text = card?.translated_text || '';

  const stop_muse_voice_live_stream = () => {
    muse_voice_connected_ref.current = false;
    set_muse_voice_connected(false);
    if (muse_pcm_processor_ref.current) {
      try {
        muse_pcm_processor_ref.current.disconnect();
        muse_pcm_processor_ref.current.onaudioprocess = null;
      } catch {
        // ignore disconnect error
      }
      muse_pcm_processor_ref.current = null;
    }
    if (muse_pcm_ctx_ref.current) {
      try {
        muse_pcm_ctx_ref.current.close();
      } catch {
        // ignore close error
      }
      muse_pcm_ctx_ref.current = null;
    }
    if (muse_voice_ws_ref.current) {
      const ws_to_drain = muse_voice_ws_ref.current;
      muse_voice_ws_ref.current = null;
      try {
        if (ws_to_drain.readyState === WebSocket.OPEN) {
          ws_to_drain.send(JSON.stringify({ type: 'endStream' }));
          setTimeout(() => {
            try {
              if (
                ws_to_drain.readyState === WebSocket.OPEN ||
                ws_to_drain.readyState === WebSocket.CONNECTING
              ) {
                ws_to_drain.close();
              }
            } catch {
              // ignore delayed close error
            }
          }, 3500);
        } else {
          ws_to_drain.close();
        }
      } catch {
        // ignore ws close error
      }
    }
  };

  const stop_live_speech_and_chunk_engines = () => {
    is_live_meeting_active_ref.current = false;
    stop_muse_voice_live_stream();
    if (chunk_loop_timer_ref.current) {
      clearInterval(chunk_loop_timer_ref.current);
      chunk_loop_timer_ref.current = null;
    }
    if (active_chunk_recorder_ref.current) {
      try {
        if (active_chunk_recorder_ref.current.state !== 'inactive') {
          active_chunk_recorder_ref.current.stop();
        }
      } catch {
        // ignore stop error
      }
      active_chunk_recorder_ref.current = null;
    }
    if (speech_rec_ref.current) {
      try {
        speech_rec_ref.current.onend = null;
        speech_rec_ref.current.stop();
      } catch {
        // ignore speech rec stop error
      }
      speech_rec_ref.current = null;
    }
  };

  const cleanup_media_resources = () => {
    stop_live_speech_and_chunk_engines();
    if (timer_interval_ref.current) {
      clearInterval(timer_interval_ref.current);
      timer_interval_ref.current = null;
    }
    if (anim_frame_ref.current) {
      cancelAnimationFrame(anim_frame_ref.current);
      anim_frame_ref.current = null;
    }
    if (media_stream_ref.current) {
      try {
        media_stream_ref.current.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore track stop error
      }
      media_stream_ref.current = null;
    }
    if (audio_ctx_ref.current) {
      try {
        audio_ctx_ref.current.close();
      } catch {
        // ignore close error
      }
      audio_ctx_ref.current = null;
    }
    analyser_ref.current = null;
    set_wave_levels(new Array(LUMEN_WAVE_BAR_COUNT).fill(15));
  };

  useEffect(() => {
    return () => {
      cleanup_media_resources();
      if (local_audio_url && local_audio_url.startsWith('blob:')) {
        URL.revokeObjectURL(local_audio_url);
      }
    };
  }, [local_audio_url]);

  // Compute acoustic vocal pitch & spectral centroid for speaker diarization when multiple people speak the same language
  const resolve_acoustic_speaker_for_utterance = () => {
    const participants_list =
      meeting_participants_ref.current && meeting_participants_ref.current.length >= 2
        ? meeting_participants_ref.current
        : [
            { id: 'speaker_a', name: 'Person A', lang: 'Auto-Detect' },
            { id: 'speaker_b', name: 'Person B', lang: 'Auto-Detect' },
          ];

    const samples = utterance_voice_samples_ref.current || [];
    utterance_voice_samples_ref.current = [];
    const silence_gap_ms = current_utterance_silence_gap_ms_ref.current || 0;
    current_utterance_silence_gap_ms_ref.current = 0;

    const prev_speaker_id =
      last_detected_speaker_id_ref.current || participants_list[0].id;

    if (samples.length === 0) {
      return {
        detectedSpeakerId: prev_speaker_id,
        previousSpeakerId: prev_speaker_id,
        voiceTelemetry: {
          pitchHz: 0,
          spectralCentroid: 0,
          silenceGapMs: silence_gap_ms,
          speakerChangedByVoice: false,
        },
      };
    }

    let sum_pitch = 0;
    let sum_centroid = 0;
    for (const s of samples) {
      sum_pitch += s.pitchHz;
      sum_centroid += s.centroidHz;
    }
    const avg_pitch_hz = Math.round(sum_pitch / samples.length);
    const avg_centroid_hz = Math.round(sum_centroid / samples.length);

    const profiles = speaker_voice_profiles_ref.current || {};
    const valid_ids = participants_list.map((p) => p.id);

    const compute_voice_distance = (profile) => {
      if (!profile) return 999;
      const pitch_diff =
        Math.abs(avg_pitch_hz - profile.pitchHz) /
        Math.max(110, profile.pitchHz);
      const centroid_diff =
        Math.abs(avg_centroid_hz - profile.centroidHz) /
        Math.max(500, profile.centroidHz);
      return pitch_diff * 0.62 + centroid_diff * 0.38;
    };

    // First ever utterance calibrates Person A
    const calibrated_ids = valid_ids.filter((id) => Boolean(profiles[id]));
    let chosen_id = prev_speaker_id;
    let speaker_changed_by_voice = false;

    if (calibrated_ids.length === 0) {
      chosen_id = valid_ids[0];
      profiles[chosen_id] = {
        pitchHz: avg_pitch_hz,
        centroidHz: avg_centroid_hz,
        count: 1,
      };
    } else {
      const prev_profile = profiles[prev_speaker_id] || profiles[calibrated_ids[0]];
      const dist_from_prev = compute_voice_distance(prev_profile);
      const uncalibrated_ids = valid_ids.filter((id) => !profiles[id]);

      // Detect if a new person is speaking (either distinct vocal pitch/timbre or turn-taking pause with vocal shift)
      const is_new_voice_shift =
        dist_from_prev >= 0.11 ||
        (silence_gap_ms >= 900 && dist_from_prev >= 0.055);

      if (is_new_voice_shift && uncalibrated_ids.length > 0) {
        // Check if it closely matches an already-calibrated other speaker first
        let best_existing_id = null;
        let best_existing_dist = 999;
        for (const cid of calibrated_ids) {
          if (cid === prev_speaker_id) continue;
          const d = compute_voice_distance(profiles[cid]);
          if (d < best_existing_dist) {
            best_existing_dist = d;
            best_existing_id = cid;
          }
        }

        if (best_existing_id && best_existing_dist < 0.085) {
          chosen_id = best_existing_id;
        } else {
          chosen_id = uncalibrated_ids[0];
          profiles[chosen_id] = {
            pitchHz: avg_pitch_hz,
            centroidHz: avg_centroid_hz,
            count: 1,
          };
        }
        speaker_changed_by_voice = chosen_id !== prev_speaker_id;
      } else {
        // Compare across all calibrated speaker profiles
        let best_id = prev_speaker_id;
        let best_dist = dist_from_prev;
        for (const cid of calibrated_ids) {
          let d = compute_voice_distance(profiles[cid]);
          // If there was a conversational turn-taking pause (>= 950ms) and vocal timbre shifted, slightly favor turn-taking
          if (cid !== prev_speaker_id && silence_gap_ms >= 950 && dist_from_prev >= 0.065) {
            d *= 0.85;
          }
          if (d < best_dist) {
            best_dist = d;
            best_id = cid;
          }
        }
        chosen_id = best_id;
        speaker_changed_by_voice = chosen_id !== prev_speaker_id;
      }

      // Smoothly update chosen speaker's voice profile
      if (profiles[chosen_id]) {
        const old_p = profiles[chosen_id];
        const alpha = Math.max(0.18, 1 / Math.min(8, (old_p.count || 1) + 1));
        profiles[chosen_id] = {
          pitchHz: Math.round(old_p.pitchHz * (1 - alpha) + avg_pitch_hz * alpha),
          centroidHz: Math.round(
            old_p.centroidHz * (1 - alpha) + avg_centroid_hz * alpha
          ),
          count: (old_p.count || 1) + 1,
        };
      }
    }

    speaker_voice_profiles_ref.current = profiles;
    last_detected_speaker_id_ref.current = chosen_id;
    set_live_detected_speaker_id(chosen_id);

    return {
      detectedSpeakerId: chosen_id,
      previousSpeakerId: prev_speaker_id,
      voiceTelemetry: {
        pitchHz: avg_pitch_hz,
        spectralCentroid: avg_centroid_hz,
        silenceGapMs: silence_gap_ms,
        speakerChangedByVoice: speaker_changed_by_voice,
      },
    };
  };

  const start_level_meter = (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audio_ctx = new AudioCtx();
      audio_ctx_ref.current = audio_ctx;
      const source = audio_ctx.createMediaStreamSource(stream);
      const analyser = audio_ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      analyser_ref.current = analyser;

      const bin_count = analyser.frequencyBinCount; // 256 bins
      const data_array = new Uint8Array(bin_count);
      const sample_rate = audio_ctx.sampleRate || 48000;
      const bin_hz = sample_rate / analyser.fftSize; // ~93.75 Hz per bin

      const update_meter = () => {
        if (!analyser_ref.current) return;
        analyser_ref.current.getByteFrequencyData(data_array);
        const next_bars = [];
        let max_energy = 0;
        const step = Math.max(1, Math.floor(bin_count / 64));
        for (let i = 0; i < LUMEN_WAVE_BAR_COUNT; i += 1) {
          const val = data_array[(i * step) % bin_count] || 0;
          if (val > max_energy) max_energy = val;
          const pct = Math.max(12, Math.min(100, Math.round((val / 255) * 100)));
          next_bars.push(pct);
        }

        const now_ms = Date.now();
        if (max_energy > 38) {
          had_voice_activity_ref.current = true;
          if (!is_currently_speaking_frame_ref.current) {
            is_currently_speaking_frame_ref.current = true;
            if (last_voice_active_ms_ref.current > 0) {
              const gap = now_ms - last_voice_active_ms_ref.current;
              if (gap > current_utterance_silence_gap_ms_ref.current) {
                current_utterance_silence_gap_ms_ref.current = gap;
              }
            }
          }
          last_voice_active_ms_ref.current = now_ms;

          // Extract vocal fundamental pitch band (80Hz - 450Hz) and spectral centroid (80Hz - 3400Hz)
          const min_pitch_bin = Math.max(1, Math.floor(80 / bin_hz));
          const max_pitch_bin = Math.min(
            bin_count - 1,
            Math.ceil(450 / bin_hz)
          );
          const max_voice_bin = Math.min(
            bin_count - 1,
            Math.ceil(3400 / bin_hz)
          );

          let pitch_weighted_sum = 0;
          let pitch_mag_sum = 0;
          for (let b = min_pitch_bin; b <= max_pitch_bin; b += 1) {
            const mag = data_array[b] || 0;
            if (mag > 25) {
              const weight = mag * mag;
              pitch_weighted_sum += b * bin_hz * weight;
              pitch_mag_sum += weight;
            }
          }

          let centroid_weighted_sum = 0;
          let centroid_mag_sum = 0;
          for (let b = min_pitch_bin; b <= max_voice_bin; b += 1) {
            const mag = data_array[b] || 0;
            if (mag > 18) {
              centroid_weighted_sum += b * bin_hz * mag;
              centroid_mag_sum += mag;
            }
          }

          if (pitch_mag_sum > 0 && centroid_mag_sum > 0) {
            const pitch_hz = pitch_weighted_sum / pitch_mag_sum;
            const centroid_hz = centroid_weighted_sum / centroid_mag_sum;
            if (utterance_voice_samples_ref.current.length < 240) {
              utterance_voice_samples_ref.current.push({
                pitchHz: pitch_hz,
                centroidHz: centroid_hz,
              });
            }
          }
        } else if (
          is_currently_speaking_frame_ref.current &&
          now_ms - last_voice_active_ms_ref.current > 320
        ) {
          is_currently_speaking_frame_ref.current = false;
        }

        // VAD-triggered early chunk completion: when speaker pauses for ~620ms after speaking,
        // flush the active audio chunk immediately so live transcription responds without delay
        if (
          is_live_meeting_active_ref.current &&
          had_voice_activity_ref.current &&
          last_voice_active_ms_ref.current > 0 &&
          now_ms - last_voice_active_ms_ref.current > 620 &&
          now_ms - chunk_started_at_ms_ref.current > 750 &&
          active_chunk_recorder_ref.current &&
          active_chunk_recorder_ref.current.state === 'recording'
        ) {
          try {
            active_chunk_recorder_ref.current.stop();
          } catch {
            // ignore stop error
          }
        }

        set_wave_levels(next_bars);
        anim_frame_ref.current = requestAnimationFrame(update_meter);
      };
      anim_frame_ref.current = requestAnimationFrame(update_meter);
    } catch {
      // Fallback if Web Audio API is unavailable
    }
  };

  const sync_meeting_turns_to_card = (next_turns) => {
    meeting_turns_ref.current = next_turns;
    const participants_summary = (meeting_participants_ref.current || [])
      .map((p) => `${p.name} (${p.lang})`)
      .join(' · ');

    const full_transcript_lines = next_turns
      .map(
        (t) =>
          `[${t.timestamp}] ${t.speakerName} (${t.sourceLanguage}): ${t.transcript}`
      )
      .join('\n');
    const full_translated_lines = next_turns
      .filter((t) => Boolean(t.translatedText))
      .map(
        (t) =>
          `[${t.timestamp}] → ${t.targetLanguage} (${t.speakerName}): ${t.translatedText}`
      )
      .join('\n');

    updateCard(
      card.id,
      {
        meeting_turns: next_turns,
        transcript: full_transcript_lines,
        translated_text: full_translated_lines,
        detected_language: participants_summary || 'Multi-Speaker Meeting',
        content: `[Live Multi-Speaker Meeting (${participants_summary})]\n${full_transcript_lines}${
          full_translated_lines ? `\n\n[Translations]\n${full_translated_lines}` : ''
        }`,
        height: Math.max(Number(card?.height) || 380, 560),
      },
      true
    );
    saveCurrentBoardToStore({ immediate: true });
  };

  const ensure_participant_for_speaker_label = (speaker_role_or_label) => {
    const raw = String(speaker_role_or_label || '').trim();
    if (!raw) return;
    const match = raw.match(/^(?:speaker_|person\s+)?([a-f])$/i);
    if (!match) return;
    const letter = match[1].toLowerCase();
    const upper = letter.toUpperCase();
    const role_id = `speaker_${letter}`;
    const current_list = meeting_participants_ref.current || [];
    if (current_list.some((p) => p.id === role_id)) {
      return;
    }
    const target_idx = upper.charCodeAt(0) - 65;
    if (target_idx < 0 || target_idx >= 6) return;
    const next_list = [...current_list];
    for (let i = current_list.length; i <= target_idx; i += 1) {
      const char_code = String.fromCharCode(65 + i);
      const id_str = `speaker_${char_code.toLowerCase()}`;
      if (!next_list.some((p) => p.id === id_str)) {
        next_list.push({
          id: id_str,
          name: `Person ${char_code}`,
          lang: 'Auto-Detect',
        });
      }
    }
    if (next_list.length !== current_list.length) {
      update_meeting_participants_on_card(next_list, true);
    }
  };

  const sync_detected_speakers_to_card = (count_val, speakers_arr) => {
    const safe_count = Math.max(0, Number(count_val) || 0);
    const safe_list = Array.isArray(speakers_arr)
      ? speakers_arr.filter(Boolean)
      : [];
    set_detected_speaker_count(safe_count);
    set_detected_speakers_list(safe_list);
    updateCard(
      card.id,
      {
        detected_speaker_count: safe_count,
        detected_speakers: safe_list,
      },
      false
    );
  };

  const append_bilingual_turns_to_card = (turns_list) => {
    const valid_turns = (Array.isArray(turns_list) ? turns_list : [turns_list]).filter(
      (t) => t && String(t.transcript || '').trim()
    );
    if (valid_turns.length === 0) return;

    const elapsed_now = Math.max(
      0,
      recording_start_ms_ref.current
        ? Math.floor((Date.now() - recording_start_ms_ref.current) / 1000)
        : elapsed_seconds
    );

    const created_entries = valid_turns.map((turn_data, idx) => {
      if (turn_data.speakerRole) {
        ensure_participant_for_speaker_label(turn_data.speakerRole);
      }
      return {
        id: `turn_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: turn_data.timestamp || format_duration_mm_ss(elapsed_now),
        speakerRole: turn_data.speakerRole || 'speaker_a',
        speakerName: turn_data.speakerName || speaker_a_name_ref.current,
        sourceLanguage: turn_data.sourceLanguage || 'English',
        targetLanguage: turn_data.targetLanguage || 'English',
        transcript: String(turn_data.transcript).trim(),
        translatedText: String(turn_data.translatedText || '').trim(),
        createdAt: Date.now() + idx,
      };
    });

    const next_turns = [...meeting_turns_ref.current, ...created_entries].slice(-80);
    sync_meeting_turns_to_card(next_turns);

    // Update detected speaker count from all turns in the session
    const unique_speakers = Array.from(
      new Set(next_turns.map((t) => t.speakerName).filter(Boolean))
    );
    if (unique_speakers.length > 0) {
      sync_detected_speakers_to_card(
        Math.max(detected_speaker_count, unique_speakers.length),
        unique_speakers
      );
    }

    const last_entry = created_entries[created_entries.length - 1];
    if (last_entry) {
      set_last_live_caption({
        speakerName: last_entry.speakerName,
        sourceLanguage: last_entry.sourceLanguage,
        targetLanguage: last_entry.targetLanguage,
        transcript: last_entry.transcript,
        translatedText: last_entry.translatedText,
        timestamp: last_entry.timestamp,
      });
      set_interim_speech_text('');
      set_interim_translated_text('');
      interim_translation_source_ref.current = '';
    }
    if (last_entry?.speakerRole) {
      last_detected_speaker_id_ref.current = last_entry.speakerRole;
      set_live_detected_speaker_id(last_entry.speakerRole);
    }

    if (tts_enabled_ref.current && last_entry?.translatedText) {
      speak_translated_utterance(
        last_entry.translatedText,
        last_entry.targetLanguage
      );
    }
  };

  const handle_cycle_turn_speaker = (turn_id) => {
    const participants_list = meeting_participants_ref.current || [];
    if (participants_list.length < 2) return;
    const next_turns = meeting_turns_ref.current.map((t) => {
      if (t.id !== turn_id) return t;
      const cur_idx = participants_list.findIndex((p) => p.id === t.speakerRole);
      const next_participant =
        participants_list[(cur_idx + 1) % participants_list.length];
      if (!next_participant) return t;
      last_detected_speaker_id_ref.current = next_participant.id;
      set_live_detected_speaker_id(next_participant.id);
      return {
        ...t,
        speakerRole: next_participant.id,
        speakerName: next_participant.name,
      };
    });
    sync_meeting_turns_to_card(next_turns);
    showToast('Updated speaker assignment for turn');
  };

  const process_live_meeting_turn = async ({
    spokenText = '',
    audioBase64 = '',
    mimeType = 'audio/webm',
    roleOverride = null,
    acousticInfo = null,
  }) => {
    const clean_text = String(spokenText || '').trim();
    if (!clean_text && (!audioBase64 || String(audioBase64).length < 64)) {
      return;
    }

    const acoustic = acousticInfo || resolve_acoustic_speaker_for_utterance();
    set_is_ai_busy(true);
    const active_role = roleOverride || active_speaker_role_ref.current || 'auto';
    const sound_ai_model = getSelectedAiModelForTask('sound_transcribe');
    set_ai_status_text(
      clean_text
        ? `Voice diarizing & translating "${clean_text.slice(0, 28)}${clean_text.length > 28 ? '...' : ''}"...`
        : 'Voice detecting speakers, language & translating...'
    );

    try {
      console.log(
        `[AI Model Usage] Function: process_live_meeting_turn (Request) | Model: ${sound_ai_model?.id || 'muse'} (${sound_ai_model?.full_name || sound_ai_model?.name || 'Muse Voice / Gemini 3 Flash'}) | Quality: { maxOutputTokens: 2048, diarization: "high" }`
      );
      const response = await fetch('/api/ai/sound-live-meeting-turn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...get_lumen_auth_headers(),
        },
        body: JSON.stringify({
          boardId: get_current_board_id_str(),
          audioBase64: audioBase64 || null,
          mimeType,
          spokenText: clean_text,
          speakerRole: active_role,
          detectedSpeakerId: acoustic.detectedSpeakerId,
          previousSpeakerId: acoustic.previousSpeakerId,
          voiceTelemetry: acoustic.voiceTelemetry,
          participants: meeting_participants_ref.current,
          globalTargetLanguage: meeting_target_lang_ref.current,
          fallbackTargetLanguage: card?.target_language || 'Indonesian',
          speakerALang: speaker_a_lang_ref.current,
          speakerBLang: speaker_b_lang_ref.current,
          speakerAName: speaker_a_name_ref.current,
          speakerBName: speaker_b_name_ref.current,
          aiModel: sound_ai_model?.id || 'muse',
          mcpProvider: sound_ai_model?.provider_id || 'muse',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        console.log(
          `[AI Debug] /api/ai/sound-live-meeting-turn HTTP ${response.status} non-OK:`,
          data
        );
        showAiErrorModal(data, {
          status_code: response.status,
          action_label: 'Live Meeting Voice Transcription',
          model_label: sound_ai_model?.full_name || sound_ai_model?.name || 'Muse Voice',
        });
      } else if (!data.isSilence) {
        console.log(
          `[AI Model Usage] Function: process_live_meeting_turn (Completed) | ModelUsed: ${data.modelUsed || sound_ai_model?.id || 'muse-voice-transcribe-1.0'} | Turns: ${Array.isArray(data.turns) ? data.turns.length : 1}`
        );
        if (typeof data.speakerCount === 'number' && data.speakerCount > 0) {
          sync_detected_speakers_to_card(
            data.speakerCount,
            data.detectedSpeakers || []
          );
        }
        if (Array.isArray(data.turns) && data.turns.length > 0) {
          append_bilingual_turns_to_card(data.turns);
        } else if (data.transcript) {
          append_bilingual_turns_to_card([data]);
        }
      }
    } catch (liveErr) {
      console.log('[AI Debug] /api/ai/sound-live-meeting-turn failed:', liveErr?.message || liveErr);
      showAiErrorModal(liveErr, {
        status_code: liveErr?.status,
        action_label: 'Live Meeting Voice Transcription',
        model_label: sound_ai_model?.full_name || sound_ai_model?.name || 'Muse Voice',
      });
    } finally {
      set_is_ai_busy(false);
      set_ai_status_text('');
    }
  };

  // ==========================================
  // Muse Voice Realtime WebSocket Stream (muse-voice-transcribe-1.0)
  // Converted from transcribe_stream.py:
  // Captures 16-bit little-endian mono PCM at 24 kHz in 80ms chunks (1920 samples = 3840 bytes)
  // with a bounded 2-frame queue (MIC_QUEUE_FRAMES = 2) and streams over WebSocket to
  // /api/ai/muse-voice-stream in DIARIZATION mode to detect how many people are in the voice.
  // ==========================================
  const start_muse_voice_live_stream = (stream) => {
    if (typeof window === 'undefined' || !stream) return;
    stop_muse_voice_live_stream();

    try {
      const ws_proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws_url = `${ws_proto}//${window.location.host}/api/ai/muse-voice-stream?mode=DIARIZATION`;
      const ws = new window.WebSocket(ws_url);
      ws.binaryType = 'arraybuffer';
      muse_voice_ws_ref.current = ws;

      // Bounded 2-frame queue matching MIC_QUEUE_FRAMES = 2 in transcribe_stream.py
      const MIC_QUEUE_FRAMES = 2;
      const TARGET_SAMPLE_RATE = 24000;
      const CHUNK_SAMPLES = 1920; // 80ms at 24kHz = 1920 samples (3840 bytes)
      const mic_frame_queue = [];
      let sample_ring = [];

      ws.onopen = () => {
        try {
          ws.send(
            JSON.stringify({
              type: 'config',
              mode: 'DIARIZATION',
              participants: meeting_participants_ref.current,
              globalTargetLanguage: meeting_target_lang_ref.current,
              fallbackTargetLanguage: card?.target_language || 'Indonesian',
              speakerRole: active_speaker_role_ref.current,
            })
          );
        } catch {
          // ignore send error
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data || '{}'));
          if (msg.type === 'session') {
            muse_voice_connected_ref.current = true;
            set_muse_voice_connected(true);
            return;
          }
          if (msg.type === 'closed' || msg.type === 'error') {
            muse_voice_connected_ref.current = false;
            set_muse_voice_connected(false);
            try {
              ws.close();
            } catch {
              // ignore close error
            }
            return;
          }
          if (msg.type === 'speaker') {
            muse_voice_connected_ref.current = true;
            if (msg.speakerRole) {
              ensure_participant_for_speaker_label(msg.speakerRole);
              last_detected_speaker_id_ref.current = msg.speakerRole;
              set_live_detected_speaker_id(msg.speakerRole);
            }
            if (typeof msg.speakerCount === 'number' && msg.speakerCount > 0) {
              sync_detected_speakers_to_card(
                msg.speakerCount,
                msg.detectedSpeakers || []
              );
            }
            return;
          }
          if (msg.type === 'transcript') {
            muse_voice_connected_ref.current = true;
            last_muse_ws_transcript_ms_ref.current = Date.now();
            last_speech_rec_final_ms_ref.current = Date.now();
            if (msg.speakerRole) {
              ensure_participant_for_speaker_label(msg.speakerRole);
              last_detected_speaker_id_ref.current = msg.speakerRole;
              set_live_detected_speaker_id(msg.speakerRole);
            }
            if (typeof msg.speakerCount === 'number' && msg.speakerCount > 0) {
              sync_detected_speakers_to_card(
                msg.speakerCount,
                msg.detectedSpeakers || []
              );
            }
            if (msg.transcript && String(msg.transcript).trim()) {
              set_interim_speech_text(String(msg.transcript).trim());
            }
            return;
          }
          if (msg.type === 'turnComplete' && msg.turn) {
            muse_voice_connected_ref.current = true;
            last_muse_ws_transcript_ms_ref.current = Date.now();
            last_speech_rec_final_ms_ref.current = Date.now();
            had_voice_activity_ref.current = false;
            if (typeof msg.speakerCount === 'number' && msg.speakerCount > 0) {
              sync_detected_speakers_to_card(
                msg.speakerCount,
                msg.detectedSpeakers || []
              );
            }
            append_bilingual_turns_to_card([msg.turn]);
          }
        } catch {
          // ignore invalid json
        }
      };

      ws.onerror = () => {
        muse_voice_connected_ref.current = false;
        set_muse_voice_connected(false);
      };

      ws.onclose = () => {
        muse_voice_connected_ref.current = false;
        set_muse_voice_connected(false);
      };

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const pcm_ctx = new AudioCtx();
      muse_pcm_ctx_ref.current = pcm_ctx;
      const input_sample_rate = pcm_ctx.sampleRate || 48000;
      const src_node = pcm_ctx.createMediaStreamSource(stream);
      const processor = pcm_ctx.createScriptProcessor(2048, 1, 1);
      muse_pcm_processor_ref.current = processor;

      processor.onaudioprocess = (audio_ev) => {
        if (!is_live_meeting_active_ref.current) return;
        const input_data = audio_ev.inputBuffer.getChannelData(0);
        if (!input_data || input_data.length === 0) return;

        // Downsample from input_sample_rate (e.g. 48000 Hz) to 24000 Hz mono int16 PCM
        if (input_sample_rate === TARGET_SAMPLE_RATE) {
          for (let i = 0; i < input_data.length; i += 1) {
            const clamped = Math.max(-1, Math.min(1, input_data[i]));
            sample_ring.push(
              clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767)
            );
          }
        } else {
          const ratio = input_sample_rate / TARGET_SAMPLE_RATE;
          const out_len = Math.floor(input_data.length / ratio);
          for (let i = 0; i < out_len; i += 1) {
            const src_idx = Math.min(input_data.length - 1, Math.floor(i * ratio));
            const clamped = Math.max(-1, Math.min(1, input_data[src_idx]));
            sample_ring.push(
              clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767)
            );
          }
        }

        while (sample_ring.length >= CHUNK_SAMPLES) {
          const frame_samples = sample_ring.slice(0, CHUNK_SAMPLES);
          sample_ring = sample_ring.slice(CHUNK_SAMPLES);
          const int16_frame = new Int16Array(frame_samples);
          if (mic_frame_queue.length >= MIC_QUEUE_FRAMES) {
            mic_frame_queue.shift();
          }
          mic_frame_queue.push(int16_frame.buffer);
        }

        if (ws.readyState === window.WebSocket.OPEN) {
          while (mic_frame_queue.length > 0) {
            const buf_to_send = mic_frame_queue.shift();
            if (buf_to_send) {
              try {
                ws.send(buf_to_send);
              } catch {
                break;
              }
            }
          }
        }
      };

      // Connect through a zero-gain node so microphone audio is not echoed out of speakers
      const zero_gain = pcm_ctx.createGain();
      zero_gain.gain.value = 0;
      src_node.connect(processor);
      processor.connect(zero_gain);
      zero_gain.connect(pcm_ctx.destination);
    } catch {
      // Fallback speech recognition and chunk loop continue if Web Audio / WebSocket fails
    }
  };

  const start_browser_speech_recognition = (role_for_lang) => {
    if (typeof window === 'undefined') return;
    const SpeechRec =
      window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!SpeechRec) return;

    if (speech_rec_ref.current) {
      try {
        speech_rec_ref.current.onend = null;
        speech_rec_ref.current.stop();
      } catch {
        // ignore stop error
      }
      speech_rec_ref.current = null;
    }

    const participants_list = meeting_participants_ref.current || [];
    const target_role = role_for_lang || active_speaker_role_ref.current || 'auto';

    // When Auto-Detect language is used or multiple distinct languages are configured in 'auto' mode,
    // let the multimodal AI audio chunk engine perform language auto-detection & multi-speaker diarization
    // unless all known languages share a single concrete BCP-47 locale (e.g. everyone speaking English).
    let chosen_lang_name = '';
    if (target_role !== 'auto') {
      const found_p = participants_list.find((p) => p.id === target_role);
      chosen_lang_name = found_p?.lang || 'Auto-Detect';
      if (chosen_lang_name === 'Auto-Detect') {
        // Use browser default locale or let chunked audio handle multi-language detection
        chosen_lang_name = '';
      }
    } else {
      const concrete_langs = Array.from(
        new Set(
          participants_list
            .map((p) => p.lang)
            .filter((l) => l && l !== 'Auto-Detect')
        )
      );
      if (concrete_langs.length === 1) {
        chosen_lang_name = concrete_langs[0];
      }
    }

    try {
      const recognition = new SpeechRec();
      if (chosen_lang_name && LUMEN_LANG_BCP47[chosen_lang_name]) {
        recognition.lang = LUMEN_LANG_BCP47[chosen_lang_name];
      } else if (typeof navigator !== 'undefined' && navigator.language) {
        recognition.lang = navigator.language;
      } else {
        recognition.lang = 'en-US';
      }
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        // Defer to Muse Voice WebSocket whenever its realtime session is active
        if (
          muse_voice_ws_ref.current &&
          muse_voice_ws_ref.current.readyState === window.WebSocket.OPEN &&
          (muse_voice_connected_ref.current ||
            Date.now() - last_muse_ws_transcript_ms_ref.current < 4500)
        ) {
          return;
        }
        let interim_str = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const res = event.results[i];
          const text_piece = String(res?.[0]?.transcript || '').trim();
          if (!text_piece) continue;
          if (res.isFinal) {
            set_interim_speech_text(text_piece);
            // If Auto-Detect or multi-language is active AND we have a live audio chunk recording,
            // flush the audio chunk immediately so the multimodal/Muse engine detects the true spoken language from voice audio
            const is_auto_lang_mode = !chosen_lang_name;
            if (
              is_auto_lang_mode &&
              active_chunk_recorder_ref.current &&
              active_chunk_recorder_ref.current.state === 'recording'
            ) {
              pending_speech_rec_fallback_ref.current = text_piece;
              had_voice_activity_ref.current = true;
              try {
                active_chunk_recorder_ref.current.stop();
                continue;
              } catch {
                // fall through to direct spokenText processing
              }
            }
            const acoustic = resolve_acoustic_speaker_for_utterance();
            last_speech_rec_final_ms_ref.current = Date.now();
            had_voice_activity_ref.current = false;
            process_live_meeting_turn({
              spokenText: text_piece,
              roleOverride: active_speaker_role_ref.current,
              acousticInfo: acoustic,
            });
          } else {
            interim_str += `${text_piece} `;
          }
        }
        if (interim_str.trim()) {
          set_interim_speech_text(interim_str.trim());
        }
      };

      recognition.onerror = () => {
        // Fallback chunk recorder continues seamlessly if speech recognition errors
      };

      recognition.onend = () => {
        if (is_live_meeting_active_ref.current) {
          try {
            recognition.start();
          } catch {
            // ignore restart race
          }
        }
      };

      recognition.start();
      speech_rec_ref.current = recognition;
    } catch {
      // Browser speech recognition unavailable; chunked AI audio loop handles it
    }
  };

  const trigger_single_live_audio_chunk = (stream, supported_mime, duration_ms = 2600) => {
    if (!stream || !is_live_meeting_active_ref.current) return;
    // Do not run a second conflicting MediaRecorder when the Muse Voice realtime
    // 24kHz PCM WebSocket stream is actively connected or connecting.
    if (
      muse_voice_ws_ref.current &&
      (muse_voice_ws_ref.current.readyState === window.WebSocket.CONNECTING ||
        (muse_voice_ws_ref.current.readyState === window.WebSocket.OPEN &&
          muse_voice_connected_ref.current))
    ) {
      return;
    }
    if (
      active_chunk_recorder_ref.current &&
      active_chunk_recorder_ref.current.state === 'recording'
    ) {
      return;
    }
    try {
      const chunk_recorder = supported_mime
        ? new window.MediaRecorder(stream, { mimeType: supported_mime })
        : new window.MediaRecorder(stream);
      const local_parts = [];
      had_voice_activity_ref.current = false;
      chunk_started_at_ms_ref.current = Date.now();

      chunk_recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          local_parts.push(ev.data);
        }
      };

      chunk_recorder.onstop = async () => {
        const had_vad = had_voice_activity_ref.current;
        const fallback_text = String(pending_speech_rec_fallback_ref.current || '').trim();
        pending_speech_rec_fallback_ref.current = '';

        // Immediately start the next chunk recorder if live meeting is still active so no speech is missed
        if (is_live_meeting_active_ref.current && media_stream_ref.current) {
          setTimeout(() => {
            if (is_live_meeting_active_ref.current && media_stream_ref.current) {
              trigger_single_live_audio_chunk(
                media_stream_ref.current,
                supported_mime,
                duration_ms
              );
            }
          }, 40);
        }

        const is_muse_ws_active =
          Boolean(
            muse_voice_ws_ref.current &&
              muse_voice_ws_ref.current.readyState === window.WebSocket.OPEN &&
              muse_voice_connected_ref.current
          ) || Date.now() - last_muse_ws_transcript_ms_ref.current < 3500;
        const recent_speech_rec =
          !fallback_text &&
          Date.now() - last_speech_rec_final_ms_ref.current < duration_ms + 300;
        if (is_muse_ws_active || recent_speech_rec || (!had_vad && !fallback_text)) {
          return;
        }
        const acoustic = resolve_acoustic_speaker_for_utterance();
        const mime = chunk_recorder.mimeType || supported_mime || 'audio/webm';
        const chunk_blob = new Blob(local_parts, { type: mime });
        if (chunk_blob.size > 2400) {
          const b64 = await blob_to_base64_data_url(chunk_blob);
          if (b64) {
            await process_live_meeting_turn({
              audioBase64: b64,
              mimeType: mime,
              spokenText: fallback_text || undefined,
              roleOverride: active_speaker_role_ref.current,
              acousticInfo: acoustic,
            });
            return;
          }
        }
        if (fallback_text) {
          await process_live_meeting_turn({
            spokenText: fallback_text,
            roleOverride: active_speaker_role_ref.current,
            acousticInfo: acoustic,
          });
        }
      };

      active_chunk_recorder_ref.current = chunk_recorder;
      chunk_recorder.start();
      setTimeout(() => {
        if (chunk_recorder.state !== 'inactive') {
          try {
            chunk_recorder.stop();
          } catch {
            // ignore stop error
          }
        }
      }, duration_ms);
    } catch {
      // ignore chunk recorder error
    }
  };

  const handle_switch_live_speaker = (next_role) => {
    set_active_speaker_role(next_role);
    active_speaker_role_ref.current = next_role;
    if (next_role !== 'auto') {
      last_detected_speaker_id_ref.current = next_role;
      set_live_detected_speaker_id(next_role);
    }
    if (is_live_meeting_active_ref.current) {
      if (
        active_chunk_recorder_ref.current &&
        active_chunk_recorder_ref.current.state !== 'inactive'
      ) {
        try {
          active_chunk_recorder_ref.current.stop();
        } catch {
          // ignore
        }
      }
      start_browser_speech_recognition(next_role);
    }
  };

  const update_meeting_participants_on_card = (
    next_participants,
    immediate_save = true
  ) => {
    meeting_participants_ref.current = next_participants;
    const p_a = next_participants[0] || {
      id: 'speaker_a',
      name: 'Person A',
      lang: 'Auto-Detect',
    };
    const p_b = next_participants[1] || {
      id: 'speaker_b',
      name: 'Person B',
      lang: 'Auto-Detect',
    };
    speaker_a_name_ref.current = p_a.name;
    speaker_a_lang_ref.current = p_a.lang;
    speaker_b_name_ref.current = p_b.name;
    speaker_b_lang_ref.current = p_b.lang;

    updateCard(
      card.id,
      {
        meeting_participants: next_participants,
        speaker_a_name: p_a.name,
        speaker_a_lang: p_a.lang,
        speaker_b_name: p_b.name,
        speaker_b_lang: p_b.lang,
      },
      immediate_save
    );
    if (immediate_save) {
      saveCurrentBoardToStore({ immediate: true });
    }
  };

  const handle_add_meeting_participant = () => {
    if (meeting_participants.length >= 6) return;
    const next_idx = meeting_participants.length;
    const letter = LUMEN_SPEAKER_LETTERS[next_idx] || String(next_idx + 1);
    const label_char = String.fromCharCode(65 + next_idx);
    const next_list = [
      ...meeting_participants,
      {
        id: `speaker_${letter}`,
        name: `Person ${label_char}`,
        lang: 'Auto-Detect',
      },
    ];
    update_meeting_participants_on_card(next_list, true);
    showToast(`Added Person ${label_char} to Live Transcribe`);
  };

  const handle_remove_meeting_participant = (participant_id) => {
    if (meeting_participants.length <= 2) return;
    const filtered = meeting_participants.filter((p) => p.id !== participant_id);
    if (active_speaker_role === participant_id) {
      set_active_speaker_role('auto');
      active_speaker_role_ref.current = 'auto';
    }
    update_meeting_participants_on_card(filtered, true);
  };

  const upload_recorded_audio_to_file_server = async (
    audio_blob,
    duration_sec,
    custom_name
  ) => {
    set_recording_status('uploading');
    set_upload_progress(0);
    set_permission_error('');

    const raw_mime = audio_blob.type || 'audio/webm';
    const clean_mime = raw_mime.split(';')[0].trim() || 'audio/webm';
    const ext = clean_mime.includes('mp4')
      ? 'm4a'
      : clean_mime.includes('ogg')
      ? 'ogg'
      : clean_mime.includes('wav')
      ? 'wav'
      : clean_mime.includes('mpeg') || clean_mime.includes('mp3')
      ? 'mp3'
      : 'webm';

    const file_name =
      custom_name ||
      `voice-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;

    // Create local preview URL and retain inline base64 for AI transcription resilience
    const object_url = URL.createObjectURL(audio_blob);
    set_local_audio_url((prev) => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return object_url;
    });

    const b64_data_url =
      audio_blob.size <= 10 * 1024 * 1024
        ? await blob_to_base64_data_url(audio_blob)
        : '';
    if (b64_data_url) {
      set_local_audio_base64(b64_data_url);
    }

    try {
      const audio_file =
        audio_blob instanceof File
          ? audio_blob
          : new File([audio_blob], file_name, {
              type: clean_mime,
              lastModified: Date.now(),
            });

      const current_board_id = get_current_board_id_str();
      const previous_file_id = card?.file_id || null;

      // Upload recorded sound directly to the file server (/api/files/upload or chunked upload)
      const res_data = await upload_lumen_file(audio_file, {
        boardId: current_board_id,
        cardId: card.id,
        mimeType: clean_mime,
        onProgress: (pct) => set_upload_progress(pct),
      });

      const resolved_file_code = res_data?.file_storage_code || res_data?.fileId;
      if (!res_data || !resolved_file_code) {
        throw new Error('File server did not return a valid fileId');
      }

      // Remove old file on file server if replacing a previous recording
      if (previous_file_id && previous_file_id !== resolved_file_code) {
        delete_storage_file_for_board_item(
          previous_file_id,
          card?.file_name || '',
          current_board_id || ''
        ).catch(() => {});
      }

      const uploaded_file_url =
        res_data.fileUrl || `/api/files/download/${resolved_file_code}`;
      const uploaded_view_url =
        res_data.viewUrl || `/api/files/view/${resolved_file_code}`;

      const recording_entry = {
        id: resolved_file_code,
        file_id: resolved_file_code,
        file_storage_code: resolved_file_code,
        file_name: res_data.fileName || file_name,
        file_type: clean_mime,
        file_size: res_data.fileSize || audio_file.size,
        file_url: uploaded_file_url,
        view_url: uploaded_view_url,
        s3_key: res_data.s3Key || null,
        duration_seconds: duration_sec,
        created_at: Date.now(),
      };

      const existing_recordings = Array.isArray(card?.recordings)
        ? card.recordings
        : [];

      const next_patch = {
        file_id: resolved_file_code,
        file_storage_code: resolved_file_code,
        file_name: res_data.fileName || file_name,
        file_type: clean_mime,
        file_extension: ext,
        file_size: res_data.fileSize || audio_file.size,
        file_url: uploaded_file_url,
        view_url: uploaded_view_url,
        storage_type: res_data.storageType || 'local',
        s3_key: res_data.s3Key || null,
        uploaded_at: Date.now(),
        duration_seconds: duration_sec,
        audio_duration: duration_sec,
        file_data: null,
        audio_base64:
          b64_data_url && audio_file.size <= 3 * 1024 * 1024 ? b64_data_url : '',
        recordings: [
          recording_entry,
          ...existing_recordings.filter((r) => r?.file_id !== res_data.fileId),
        ].slice(0, 10),
      };

      set_pending_audio_blob(null);
      updateCard(card.id, next_patch, true);
      saveCurrentBoardToStore({ immediate: true });

      if (res_data.storage) {
        showToast(
          `Uploaded recording to File Server (${res_data.storage.used_gb} / ${res_data.storage.limit_gb} GB used)`
        );
      } else {
        showToast(`Uploaded ${res_data.fileName || file_name} to File Server`);
      }
    } catch (err) {
      set_pending_audio_blob({
        blob: audio_blob,
        duration_sec,
        file_name,
      });
      if (b64_data_url || object_url) {
        updateCard(
          card.id,
          {
            file_name,
            file_type: clean_mime,
            file_size: audio_blob.size,
            duration_seconds: duration_sec,
            audio_duration: duration_sec,
            ...(b64_data_url ? { audio_base64: b64_data_url } : {}),
          },
          true
        );
        saveCurrentBoardToStore({ immediate: true });
        set_permission_error('');
        showToast('Recording saved to card');
      } else {
        const raw_err = String(err?.message || '');
        const clean_err =
          raw_err.includes('Unexpected token') || raw_err.includes('<!doctype')
            ? 'File server busy — recording kept in local session.'
            : raw_err || 'Failed to upload recorded audio to file server.';
        set_permission_error(clean_err);
        showToast(clean_err);
      }
    } finally {
      set_recording_status('idle');
      set_upload_progress(0);
    }
  };

  const check_microphone_permission_state = async () => {
    if (has_granted_mic_session_ref.current) {
      return 'granted';
    }
    if (
      typeof navigator !== 'undefined' &&
      navigator.permissions &&
      typeof navigator.permissions.query === 'function'
    ) {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' });
        if (status && status.state === 'granted') {
          has_granted_mic_session_ref.current = true;
          return 'granted';
        }
        if (status && (status.state === 'prompt' || status.state === 'denied')) {
          return status.state;
        }
      } catch {
        // Fallback if browser does not support querying 'microphone'
      }
    }
    return 'prompt';
  };

  const handle_start_recording = async (
    e,
    start_in_live_meeting = false,
    confirmed_from_popup = false
  ) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    if (
      recording_status === 'recording' ||
      recording_status === 'requesting_permission' ||
      recording_status === 'uploading'
    ) {
      return;
    }
    set_permission_error('');

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      set_permission_error(
        'Microphone recording is not supported in this browser environment. You can upload an audio file or type below.'
      );
      set_pending_live_meeting_start(Boolean(start_in_live_meeting));
      set_show_mic_permission_popup(true);
      return;
    }

    // Only show Microphone access request popup when user tries to record and does not yet have permission
    if (!confirmed_from_popup && !has_granted_mic_session_ref.current) {
      const perm_state = await check_microphone_permission_state();
      if (perm_state !== 'granted') {
        set_pending_live_meeting_start(Boolean(start_in_live_meeting));
        set_show_mic_permission_popup(true);
        return;
      }
    }

    set_show_mic_permission_popup(false);
    set_recording_status('requesting_permission');

    try {
      // Prompt for microphone permission when the user clicks Allow / Start Recording, with fallback to basic { audio: true }
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (constraint_err) {
        const c_name = String(constraint_err?.name || '');
        if (
          c_name === 'OverconstrainedError' ||
          c_name === 'ConstraintNotSatisfiedError' ||
          c_name === 'TypeError'
        ) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw constraint_err;
        }
      }

      has_granted_mic_session_ref.current = true;
      set_show_mic_permission_popup(false);
      media_stream_ref.current = stream;
      audio_chunks_ref.current = [];

      const supported_mime = get_supported_audio_mime_type();
      const recorder = supported_mime
        ? new window.MediaRecorder(stream, { mimeType: supported_mime })
        : new window.MediaRecorder(stream);

      media_recorder_ref.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audio_chunks_ref.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const final_duration = Math.max(
          1,
          Math.round((Date.now() - recording_start_ms_ref.current) / 1000)
        );
        const mime_type =
          recorder.mimeType || supported_mime || 'audio/webm';
        const audio_blob = new Blob(audio_chunks_ref.current, {
          type: mime_type,
        });
        cleanup_media_resources();
        if (audio_blob.size > 0) {
          await upload_recorded_audio_to_file_server(audio_blob, final_duration);
        } else {
          set_recording_status('idle');
        }
      };

      recorder.onerror = (event) => {
        cleanup_media_resources();
        set_recording_status('idle');
        const err_msg =
          event?.error?.message || 'Recording encountered an unexpected error.';
        set_permission_error(err_msg);
        showToast(err_msg);
      };

      recording_start_ms_ref.current = Date.now();
      set_elapsed_seconds(0);
      recorder.start(250);
      set_recording_status('recording');

      start_level_meter(stream);

      const use_live_meeting =
        start_in_live_meeting || recorder_mode === 'live_meeting';
      if (use_live_meeting) {
        is_live_meeting_active_ref.current = true;
        utterance_voice_samples_ref.current = [];
        last_voice_active_ms_ref.current = 0;
        current_utterance_silence_gap_ms_ref.current = 0;
        // Start Muse Voice (muse-voice-transcribe-1.0) 24kHz PCM WebSocket diarization stream
        start_muse_voice_live_stream(stream);
        start_browser_speech_recognition(active_speaker_role_ref.current);
        // Start fast VAD-aware live audio chunk loop (2.6s max window, early flush on pause)
        trigger_single_live_audio_chunk(stream, supported_mime, 2600);
        chunk_loop_timer_ref.current = setInterval(() => {
          if (is_live_meeting_active_ref.current && media_stream_ref.current) {
            trigger_single_live_audio_chunk(
              media_stream_ref.current,
              supported_mime,
              2600
            );
          }
        }, 2700);
        showToast(
          'Voice Live Transcribe active — auto-detecting speakers & languages'
        );
      } else {
        showToast('Microphone active — recording started');
      }

      timer_interval_ref.current = setInterval(() => {
        const sec = Math.floor(
          (Date.now() - recording_start_ms_ref.current) / 1000
        );
        set_elapsed_seconds(sec);
      }, 250);
    } catch (err) {
      cleanup_media_resources();
      set_recording_status('idle');
      has_granted_mic_session_ref.current = false;
      const err_name = String(err?.name || '');
      const err_msg_raw = String(err?.message || '');
      let user_err_msg = '';

      if (
        err_name === 'NotAllowedError' ||
        err_name === 'PermissionDeniedError' ||
        err_name === 'SecurityError'
      ) {
        if (/permissions policy|not allowed in this document|feature policy/i.test(err_msg_raw)) {
          user_err_msg =
            'Microphone access is blocked in this embedded preview frame. Please allow microphone access in your browser settings or open the app in a new browser tab to record.';
        } else {
          user_err_msg =
            'Microphone permission was denied or not yet granted. Please allow microphone access in your browser address bar settings and click Allow Microphone Access.';
        }
        set_pending_live_meeting_start(Boolean(start_in_live_meeting));
        set_show_mic_permission_popup(true);
      } else if (
        err_name === 'NotFoundError' ||
        err_name === 'DevicesNotFoundError'
      ) {
        user_err_msg =
          'No microphone device was detected on your system. Please connect a microphone or upload an audio file.';
      } else {
        user_err_msg =
          err_msg_raw ||
          'Could not access microphone. Please check your browser microphone permissions.';
      }

      set_permission_error(user_err_msg);
      showToast(user_err_msg);
    }
  };

  const handle_stop_recording = (e) => {
    if (e) e.stopPropagation();
    stop_live_speech_and_chunk_engines();
    const recorder = media_recorder_ref.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        cleanup_media_resources();
        set_recording_status('idle');
      }
    } else {
      cleanup_media_resources();
      set_recording_status('idle');
    }
  };

  const handle_file_upload_change = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    set_permission_error('');
    await upload_recorded_audio_to_file_server(
      file,
      Number(card?.audio_duration || card?.duration_seconds || 0),
      file.name
    );
    if (file_input_ref.current) {
      file_input_ref.current.value = '';
    }
  };

  const handle_retry_server_upload = async (e) => {
    if (e) e.stopPropagation();
    if (!pending_audio_blob?.blob) return;
    await upload_recorded_audio_to_file_server(
      pending_audio_blob.blob,
      pending_audio_blob.duration_sec,
      pending_audio_blob.file_name
    );
  };

  const handle_clear_all_card_data = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (recording_status === 'recording') {
      stop_live_speech_and_chunk_engines();
      cleanup_media_resources();
      set_recording_status('idle');
    }
    const current_board_id = get_current_board_id_str();
    if (card?.file_id) {
      delete_storage_file_for_board_item(
        card.file_id,
        card?.file_name || '',
        current_board_id || ''
      ).catch(() => {});
    }
    if (Array.isArray(card?.recordings)) {
      card.recordings.forEach((rec) => {
        if (rec?.file_id && rec.file_id !== card?.file_id) {
          delete_storage_file_for_board_item(
            rec.file_id,
            rec?.file_name || '',
            current_board_id || ''
          ).catch(() => {});
        }
      });
    }
    if (local_audio_url && local_audio_url.startsWith('blob:')) {
      URL.revokeObjectURL(local_audio_url);
    }
    if (audio_player_ref.current) {
      try {
        audio_player_ref.current.pause();
        audio_player_ref.current.currentTime = 0;
      } catch {
        // ignore audio reset error
      }
    }

    meeting_turns_ref.current = [];
    speaker_voice_profiles_ref.current = {};
    utterance_voice_samples_ref.current = [];
    last_detected_speaker_id_ref.current = 'speaker_a';
    detected_speaker_labels_set_ref.current = new Set();

    set_detected_speaker_count(0);
    set_detected_speakers_list([]);
    set_muse_voice_connected(false);
    set_live_detected_speaker_id('speaker_a');
    set_local_audio_url('');
    set_local_audio_base64('');
    set_pending_audio_blob(null);
    set_elapsed_seconds(0);
    set_permission_error('');
    set_interim_speech_text('');
    set_interim_translated_text('');
    set_interim_target_lang('');
    set_is_interim_translating(false);
    set_last_live_caption(null);
    set_quick_turn_text('');
    set_ai_status_text('');

    updateCard(
      card.id,
      {
        file_id: null,
        file_name: '',
        file_type: '',
        file_extension: '',
        file_url: '',
        view_url: '',
        storage_type: '',
        s3_key: null,
        file_size: 0,
        file_data: null,
        audio_base64: '',
        duration_seconds: 0,
        audio_duration: 0,
        recordings: [],
        transcript: '',
        translated_text: '',
        detected_language: '',
        content: '',
        meeting_turns: [],
        detected_speaker_count: 0,
        detected_speakers: [],
      },
      true
    );
    saveCurrentBoardToStore({ immediate: true });
    showToast('Cleared all Sound Recorder card data');
  };

  const handle_clear_recording = (e) => {
    handle_clear_all_card_data(e);
  };

  const handle_clear_meeting_turns = (e) => {
    if (e) e.stopPropagation();
    meeting_turns_ref.current = [];
    speaker_voice_profiles_ref.current = {};
    utterance_voice_samples_ref.current = [];
    last_detected_speaker_id_ref.current = 'speaker_a';
    detected_speaker_labels_set_ref.current = new Set();
    set_detected_speaker_count(0);
    set_detected_speakers_list([]);
    set_live_detected_speaker_id('speaker_a');
    set_interim_speech_text('');
    set_interim_translated_text('');
    set_interim_target_lang('');
    set_last_live_caption(null);
    updateCard(
      card.id,
      {
        meeting_turns: [],
        transcript: '',
        translated_text: '',
        detected_language: '',
        content: '',
        detected_speaker_count: 0,
        detected_speakers: [],
      },
      true
    );
    saveCurrentBoardToStore({ immediate: true });
    showToast('Cleared Live Transcribe log & reset detected speakers');
  };

  const handle_quick_turn_submit = async (e) => {
    if (e) e.preventDefault();
    const text = quick_turn_text.trim();
    if (!text || is_ai_busy) return;
    set_quick_turn_text('');
    await process_live_meeting_turn({
      spokenText: text,
      roleOverride: active_speaker_role,
    });
  };

  const resolve_client_audio_base64 = async () => {
    if (card?.audio_base64 && String(card.audio_base64).length > 32) {
      return String(card.audio_base64);
    }
    if (local_audio_base64 && String(local_audio_base64).length > 32) {
      return String(local_audio_base64);
    }
    if (pending_audio_blob?.blob) {
      const b64 = await blob_to_base64_data_url(pending_audio_blob.blob);
      if (b64) {
        set_local_audio_base64(b64);
        return b64;
      }
    }
    const candidate_url = local_audio_url || server_view_url;
    if (candidate_url) {
      try {
        const resp = await fetch(candidate_url, {
          headers: candidate_url.startsWith('/api/') ? get_lumen_auth_headers() : undefined,
        });
        if (resp.ok) {
          const blob = await resp.blob();
          if (blob && blob.size > 0 && blob.size <= 12 * 1024 * 1024) {
            const b64 = await blob_to_base64_data_url(blob);
            if (b64) {
              set_local_audio_base64(b64);
              return b64;
            }
          }
        }
      } catch {
        // ignore fetch error
      }
    }
    return '';
  };

  const handle_seek_audio_to_seconds = (seconds_val, custom_label = '') => {
    const player = audio_player_ref.current;
    if (!player) {
      showToast('No audio recording available to play at this timestamp');
      return;
    }
    try {
      const target_sec = Math.max(0, Number(seconds_val) || 0);
      player.currentTime = target_sec;
      player.play().catch(() => {});
      if (custom_label) {
        showToast(
          `Playing recording at [${format_duration_mm_ss(target_sec)}] — ${custom_label}`
        );
      }
    } catch {
      // ignore seek error
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const on_verify_timestamp = (ev) => {
      const detail = ev?.detail || {};
      if (detail.soundCardId && detail.soundCardId !== card?.id) {
        return;
      }
      handle_seek_audio_to_seconds(detail.seconds || 0, detail.label || 'Verifying key point');
    };
    window.addEventListener('lumen:verify-recording-timestamp', on_verify_timestamp);
    return () => {
      window.removeEventListener('lumen:verify-recording-timestamp', on_verify_timestamp);
    };
  }, [card?.id]);

  const handle_create_rich_note_card = async () => {
    if (is_ai_busy) return;
    set_is_ai_busy(true);
    set_ai_status_text(
      'Creating Note card & checking content for actionable tasks (Checklist) with Muse (muse-wonder-1.0)...'
    );
    try {
      if (!transcript_text.trim()) {
        const effective_b64 = await resolve_client_audio_base64();
        if (effective_b64 && !card?.audio_base64 && effective_b64.length <= 4 * 1024 * 1024) {
          updateCard(card.id, { audio_base64: effective_b64 }, false);
        }
      }
      await runAiCardAction(card.id, 'sound_create_note');
    } finally {
      set_is_ai_busy(false);
      set_ai_status_text('');
    }
  };


  const handle_ai_process = async (mode) => {
    if (is_ai_busy) return;
    const has_existing_transcript = Boolean(transcript_text && transcript_text.trim());
    const effective_mode =
      mode === 'both' && has_existing_transcript ? 'translate' : mode;

    set_is_ai_busy(true);
    set_permission_error('');
    set_ai_status_text(
      effective_mode === 'transcribe'
        ? 'Transcribing & diarizing speakers with Voice...'
        : effective_mode === 'translate'
        ? `Translating existing transcript with timestamps to ${target_language} using Muse AI...`
        : `Transcribing (Voice) & translating with timestamps to ${target_language} using Muse AI...`
    );

    const effective_duration_sec = Math.max(
      0,
      Number(
        audio_player_ref.current?.duration ||
          card?.audio_duration ||
          card?.duration_seconds ||
          elapsed_seconds ||
          0
      ) || 0
    );

    try {
      const current_board_id = get_current_board_id_str();
      const sound_ai_model = getSelectedAiModelForTask('sound_transcribe');
      const needs_audio_transcription =
        effective_mode === 'transcribe' || !has_existing_transcript;
      const effective_audio_b64 = needs_audio_transcription
        ? await resolve_client_audio_base64()
        : '';

      console.log(
        `[AI Model Usage] Function: handle_ai_process (${effective_mode}) (Request) | Model: ${sound_ai_model?.id || 'muse'} (${sound_ai_model?.full_name || sound_ai_model?.name || 'Muse Voice / Muse Wonder'}) | TargetLang: ${target_language} | Quality: { reasoningEffort: "high", maxOutputTokens: 8192 }`
      );

      const response = await fetch('/api/ai/sound-transcribe-translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...get_lumen_auth_headers(),
        },
        body: JSON.stringify({
          cardId: card.id,
          boardId: current_board_id,
          fileId: needs_audio_transcription ? card?.file_id || null : null,
          audioBase64: effective_audio_b64 || '',
          mimeType: card?.file_type || pending_audio_blob?.blob?.type || 'audio/webm',
          transcript: transcript_text,
          targetLanguage: target_language,
          mode: effective_mode,
          cardTitle: card?.title || 'Sound Recorder',
          aiModel: sound_ai_model?.id || 'muse',
          mcpProvider: sound_ai_model?.provider_id || 'muse',
          durationSeconds: Math.round(effective_duration_sec),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        if (response.status === 429 || data?.quotaExceeded || response.status === 403 || response.status === 504) {
          const quota_err = new Error(data?.error || `AI transcription request failed (${response.status})`);
          quota_err.status = response.status;
          quota_err.responsePayload = data;
          throw quota_err;
        }
        console.log(
          `[AI Debug] /api/ai/sound-transcribe-translate (${effective_mode}) HTTP ${response.status} non-OK, falling back to runAiCardAction:`,
          data
        );
        const fallback_action =
          effective_mode === 'transcribe'
            ? 'sound_transcribe'
            : effective_mode === 'translate'
            ? 'sound_translate'
            : 'sound_transcribe_and_translate';
        await runAiCardAction(card.id, fallback_action, target_language);
      } else {
        console.log(
          `[AI Model Usage] Function: handle_ai_process (${effective_mode}) (Completed) | ModelUsed: ${data.modelUsed || sound_ai_model?.id || 'muse-voice-transcribe-1.0'} | DetectedLang: ${data.detectedLanguage || 'Auto-detected'}`
        );
        const next_updates = {};
        let ref_ts = [];
        if (effective_mode === 'translate' && has_existing_transcript) {
          const existing_ts = ensure_client_timestamped_lines(
            transcript_text.trim(),
            effective_duration_sec
          );
          ref_ts = existing_ts.timestamps;
        } else if (typeof data.transcript === 'string' && data.transcript.trim()) {
          const ts_tr = ensure_client_timestamped_lines(
            data.transcript.trim(),
            effective_duration_sec
          );
          next_updates.transcript = ts_tr.formattedText;
          ref_ts = ts_tr.timestamps;
        } else if (has_existing_transcript) {
          const existing_ts = ensure_client_timestamped_lines(
            transcript_text.trim(),
            effective_duration_sec
          );
          ref_ts = existing_ts.timestamps;
        }

        if (
          typeof data.translatedText === 'string' &&
          data.translatedText.trim() &&
          effective_mode !== 'transcribe'
        ) {
          const ts_trans = ensure_client_timestamped_lines(
            data.translatedText.trim(),
            effective_duration_sec,
            ref_ts
          );
          next_updates.translated_text = ts_trans.formattedText;
          next_updates.height = Math.max(Number(card?.height) || 380, 488);
        }
        if (data.detectedLanguage) {
          next_updates.detected_language = data.detectedLanguage;
        }
        if (data.sessionId) {
          next_updates.muse_session_id = String(data.sessionId);
        }
        if (
          Number(data.audioDurationSeconds) > 0 &&
          !(Number(card?.audio_duration) > 0)
        ) {
          const dur_sec = Math.max(1, Math.round(Number(data.audioDurationSeconds)));
          next_updates.audio_duration = dur_sec;
          next_updates.duration_seconds = dur_sec;
        }
        if (Number(data.speakerCount) > 0) {
          const spk_count = Number(data.speakerCount);
          const spk_names = Array.isArray(data.detectedSpeakers)
            ? data.detectedSpeakers
            : [];
          spk_names.forEach((name_str) => {
            const m = String(name_str || '').match(/Person\s+([A-Z])/i);
            if (m && m[1]) {
              const lbl = m[1].toUpperCase();
              detected_speaker_labels_set_ref.current.add(lbl);
              ensure_participant_for_speaker_label(lbl);
            }
          });
          set_detected_speaker_count(spk_count);
          set_detected_speakers_list(spk_names);
          next_updates.detected_speaker_count = spk_count;
          next_updates.detected_speakers = spk_names;
        }
        const final_transcript = next_updates.transcript || transcript_text;
        const final_translated =
          next_updates.translated_text || (mode === 'transcribe' ? translated_text : '');
        if (final_transcript || final_translated) {
          next_updates.content = [
            final_transcript
              ? `[Transcript (${next_updates.detected_language || card?.detected_language || 'Audio'})]\n${final_transcript}`
              : '',
            final_translated
              ? `[Translation (${target_language})]\n${final_translated}`
              : '',
          ]
            .filter(Boolean)
            .join('\n\n');
        }
        if (Object.keys(next_updates).length > 0) {
          updateCard(card.id, next_updates, true);
          saveCurrentBoardToStore({ immediate: true });
          const spk_suffix =
            Number(data.speakerCount) > 0
              ? ` (${data.speakerCount} ${Number(data.speakerCount) === 1 ? 'person' : 'people'} detected in voice)`
              : '';
          showToast(
            mode === 'transcribe'
              ? `Transcribed audio recording with Voice${spk_suffix}`
              : `Translated recording with [MM:SS] timestamps to ${target_language}${spk_suffix}`
          );
        }
      }
    } catch (err) {
      console.log('[AI Debug] Sound recorder transcription/translation failed:', err?.message || err, err);
      set_permission_error(
        err?.message || 'AI transcription failed. Please try again.'
      );
      showAiErrorModal(err, {
        status_code: err?.status,
        action_label:
          effective_mode === 'transcribe'
            ? 'Sound Recorder AI Transcription'
            : effective_mode === 'translate'
            ? `Sound Recorder AI Translation (${target_language})`
            : `Sound Recorder AI Transcribe & Translate (${target_language})`,
        model_label: sound_ai_model?.full_name || sound_ai_model?.name || 'Muse Voice',
      });
    } finally {
      set_is_ai_busy(false);
      set_ai_status_text('');
    }
  };

  const is_recording = recording_status === 'recording';
  const is_requesting = recording_status === 'requesting_permission';
  const is_uploading = recording_status === 'uploading';
  const is_stored_on_server = Boolean(card?.file_id);
  const is_live_meeting_mode = recorder_mode === 'live_meeting';
  const transcript_segments = parse_timestamped_segments_for_display(transcript_text);
  const translated_segments = parse_timestamped_segments_for_display(translated_text);

  const active_participant_obj =
    active_speaker_role === 'auto'
      ? meeting_participants.find((p) => p.id === live_detected_speaker_id) ||
        meeting_participants[0]
      : meeting_participants.find((p) => p.id === active_speaker_role) ||
        meeting_participants[0];

  return (
    <div
      className={styles['lumen-sound-recorder-card']}
      data-lumen-no-card-drag="true"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Mode Switcher: Standard Voice Recorder vs. Live Transcribe (Voice Diarization) */}
      <div className={styles['lumen-sound-mode-tabs']}>
        <button
          type="button"
          className={`${styles['lumen-sound-mode-tab']} ${
            !is_live_meeting_mode ? styles['lumen-sound-mode-tab-active'] : ''
          }`}
          onClick={() => {
            updateCard(card.id, { recorder_mode: 'recorder' }, true);
            saveCurrentBoardToStore({ immediate: true });
          }}
        >
          <Mic size={12} />
          <span>Voice Recorder</span>
        </button>
        <button
          type="button"
          className={`${styles['lumen-sound-mode-tab']} ${
            is_live_meeting_mode ? styles['lumen-sound-mode-tab-active'] : ''
          }`}
          onClick={() => {
            updateCard(
              card.id,
              {
                recorder_mode: 'live_meeting',
                meeting_participants,
                speaker_a_lang,
                speaker_b_lang,
                height: Math.max(Number(card?.height) || 380, 560),
                width: Math.max(Number(card?.width) || 340, 396),
              },
              true
            );
            saveCurrentBoardToStore({ immediate: true });
          }}
        >
          <Users size={12} />
          <span>
            Live Transcribe
            {detected_speaker_count > 0 ? ` (${detected_speaker_count}P)` : ''}
          </span>
        </button>
      </div>

      {/* Top Status & Timer Bar */}
      <div className={styles['lumen-sound-top-bar']}>
        <div
          className={`${styles['lumen-sound-status-badge']} ${
            is_recording
              ? styles['lumen-sound-status-badge-recording']
              : is_requesting || is_uploading
              ? styles['lumen-sound-status-badge-requesting']
              : is_stored_on_server
              ? styles['lumen-sound-status-badge-ready']
              : ''
          }`}
        >
          <span
            className={`${styles['lumen-sound-pulse-dot']} ${
              is_recording || is_requesting || is_uploading
                ? styles['lumen-sound-pulse-dot-active']
                : ''
            }`}
          />
          <span>
            {is_requesting
              ? 'Asking Mic Permission...'
              : is_recording
              ? is_live_meeting_mode
                ? active_speaker_role === 'auto'
                  ? `Voice Diarizing (${
                      detected_speaker_count > 0
                        ? `${detected_speaker_count} ${
                            detected_speaker_count === 1 ? 'Person' : 'Persons'
                          } · `
                        : ''
                    }${active_participant_obj?.name || 'Person A'})`
                  : `Listening: ${active_participant_obj?.name} (${active_participant_obj?.lang})`
                : 'Recording Live'
              : is_uploading
              ? `Uploading to File Server${upload_progress > 0 ? ` (${upload_progress}%)` : '...'}`
              : is_stored_on_server
              ? card?.storage_type === 'spaces'
                ? 'Saved on Cloud File Server'
                : 'Saved on File Server'
              : resolved_audio_src
              ? 'Local Audio Ready'
              : is_live_meeting_mode
              ? `Voice Ready (${
                  detected_speaker_count > 0
                    ? `${detected_speaker_count} Detected`
                    : 'Auto Speaker Count'
                })`
              : 'Ready to Record'}
          </span>
        </div>

        <div className={styles['lumen-sound-top-right-group']}>
          <div className={styles['lumen-sound-timer']}>
            {format_duration_mm_ss(
              is_recording
                ? elapsed_seconds
                : card?.audio_duration || card?.duration_seconds || elapsed_seconds
            )}
          </div>
          <button
            type="button"
            className={styles['lumen-sound-clear-card-btn']}
            onClick={handle_clear_all_card_data}
            disabled={is_uploading || is_ai_busy}
            title="Clear all recording, transcript, translation, and meeting data on this card"
          >
            <Trash2 size={11} />
            <span>Clear Data</span>
          </button>
        </div>
      </div>

      {/* Permission / Upload Error Notification Banner */}
      {permission_error && (
        <div className={styles['lumen-sound-permission-banner']} role="alert">
          <div className={styles['lumen-sound-permission-banner-header']}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <AlertCircle size={13} />
              {pending_audio_blob ? 'File Server Upload Issue' : 'Microphone Access'}
            </span>
          </div>
          <div>{permission_error}</div>
          <div className={styles['lumen-sound-permission-actions']}>
            {pending_audio_blob ? (
              <button
                type="button"
                className={styles['lumen-sound-retry-btn']}
                onClick={handle_retry_server_upload}
              >
                <Cloud size={11} />
                Retry Upload to File Server
              </button>
            ) : (
              <button
                type="button"
                className={styles['lumen-sound-retry-btn']}
                onClick={(e) => handle_start_recording(e, is_live_meeting_mode)}
              >
                <Mic size={11} />
                Request Permission & Retry
              </button>
            )}
            <button
              type="button"
              className={styles['lumen-sound-secondary-btn']}
              onClick={() => file_input_ref.current?.click()}
            >
              <Upload size={11} />
              Upload Audio File
            </button>
          </div>
        </div>
      )}

      {/* LIVE TRANSCRIBE (MUSE VOICE DIARIZATION & MULTI-SPEAKER INTERPRETER) PANEL */}
      {is_live_meeting_mode && (
        <div className={styles['lumen-sound-meeting-panel']}>
          {/* Meeting Translation Target Language Bar */}
          <div className={styles['lumen-sound-target-bar']}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Languages size={12} color="#2563eb" />
              <span>Translate To:</span>
            </span>
            <select
              className={styles['lumen-sound-lang-select']}
              value={meeting_target_lang}
              onChange={(e) => {
                const next_target = e.target.value;
                meeting_target_lang_ref.current = next_target;
                updateCard(
                  card.id,
                  {
                    meeting_target_lang: next_target,
                    ...(next_target !== 'Auto'
                      ? { target_language: next_target }
                      : {}),
                  },
                  true
                );
                saveCurrentBoardToStore({ immediate: true });
              }}
              title="Choose which language spoken turns should be translated into"
            >
              <option value="Auto">Auto (Other Speaker&apos;s Language)</option>
              {LUMEN_SUPPORTED_LANGUAGES.map((lang) => (
                <option key={`meeting_target_${lang}`} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          {/* Live Waveform & Start / Stop Live Transcribe Controls */}
          <div className={styles['lumen-sound-waveform-row']} aria-hidden="true">
            {wave_levels.map((lvl, idx) => (
              <div
                key={idx}
                className={`${styles['lumen-sound-wave-bar']} ${
                  is_recording ? styles['lumen-sound-wave-bar-active'] : ''
                }`}
                style={{
                  height: `${is_recording ? lvl : 18}%`,
                }}
              />
            ))}
          </div>

          <div className={styles['lumen-sound-controls-row']}>
            {!is_recording ? (
              <button
                type="button"
                className={styles['lumen-sound-primary-btn']}
                onClick={(e) => handle_start_recording(e, true)}
                disabled={is_requesting || is_uploading}
              >
                {is_requesting || is_uploading ? (
                  <Loader2 size={14} className={styles['lumen-sound-spin']} />
                ) : (
                  <Mic size={14} />
                )}
                <span>
                  {is_requesting
                    ? 'Allow Microphone...'
                    : is_uploading
                    ? `Saving Audio (${upload_progress || 0}%)...`
                    : 'Start Live Transcribe & Translate'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                className={`${styles['lumen-sound-primary-btn']} ${styles['lumen-sound-stop-btn']}`}
                onClick={handle_stop_recording}
              >
                <Square size={13} fill="currentColor" />
                <span>Stop Live Transcribe & Save Audio</span>
              </button>
            )}
          </div>

          {/* Recorded Audio Playback Box (placed directly below Start Live Transcribe & Translate button) */}
          {resolved_audio_src && (
            <div className={styles['lumen-sound-player-box']}>
              <audio
                ref={audio_player_ref}
                controls
                preload="metadata"
                src={resolved_audio_src}
                onLoadedMetadata={handle_audio_metadata_duration_fix}
                onDurationChange={(e) => {
                  const el = e?.currentTarget;
                  if (
                    el &&
                    Number.isFinite(el.duration) &&
                    el.duration > 0 &&
                    el.currentTime > el.duration
                  ) {
                    el.currentTime = 0;
                  }
                }}
                className={styles['lumen-sound-audio-element']}
              />
              <div className={styles['lumen-sound-player-meta']}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    maxWidth: '64%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={card?.file_name || 'Voice Recording'}
                >
                  {is_stored_on_server ? (
                    <Cloud size={12} color="#059669" />
                  ) : (
                    <Volume2 size={12} />
                  )}
                  <span>{card?.file_name || 'Voice Recording'}</span>
                  {card?.file_size ? (
                    <span style={{ opacity: 0.75 }}>
                      ({format_audio_bytes(card.file_size)})
                    </span>
                  ) : null}
                </span>

                <div className={styles['lumen-sound-meta-actions']}>
                  <a
                    href={server_download_url || resolved_audio_src}
                    download={card?.file_name || 'voice-recording.webm'}
                    className={styles['lumen-sound-icon-link']}
                  >
                    <Download size={12} />
                    Download
                  </a>
                  <button
                    type="button"
                    className={styles['lumen-sound-icon-link']}
                    style={{ color: '#dc2626' }}
                    onClick={handle_clear_recording}
                    title="Delete recording from file server"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Real-time live speech & live translation banner (always mounted so it never disappears) */}
          <div className={styles['lumen-sound-interim-banner']}>
            <div className={styles['lumen-sound-interim-header']}>
              <span className={styles['lumen-sound-interim-speaker']}>
                {recording_status === 'recording' ||
                is_interim_translating ||
                is_ai_busy ? (
                  <Loader2 size={11} className={styles['lumen-sound-spin']} />
                ) : (
                  <Languages size={11} />
                )}
                <span>
                  {interim_speech_text
                    ? `${active_participant_obj?.name || 'Live Speaker'} (Speaking Live)`
                    : last_live_caption?.speakerName ||
                      meeting_turns[meeting_turns.length - 1]?.speakerName ||
                      `${active_participant_obj?.name || 'Person A'} — Live Caption & Translation`}
                </span>
              </span>
              <span className={styles['lumen-sound-interim-time']}>
                <Clock size={9} />
                {interim_speech_text
                  ? format_duration_mm_ss(elapsed_seconds)
                  : last_live_caption?.timestamp ||
                    meeting_turns[meeting_turns.length - 1]?.timestamp ||
                    format_duration_mm_ss(elapsed_seconds)}
              </span>
            </div>

            <div className={styles['lumen-sound-interim-original']}>
              {interim_speech_text ||
                last_live_caption?.transcript ||
                meeting_turns[meeting_turns.length - 1]?.transcript ||
                (recording_status === 'recording'
                  ? 'Listening with Voice (24kHz PCM Diarization)... Speak in any language to auto-detect how many people are in the voice.'
                  : 'Voice Live Transcribe & real-time translation ready. Click Start Live Transcribe & Translate or type below.')}
            </div>

            <div className={styles['lumen-sound-interim-translated']}>
              <span className={styles['lumen-sound-interim-lang-tag']}>
                →{' '}
                {interim_speech_text
                  ? interim_target_lang ||
                    (meeting_target_lang !== 'Auto'
                      ? meeting_target_lang
                      : target_language || 'Indonesian')
                  : last_live_caption?.targetLanguage ||
                    meeting_turns[meeting_turns.length - 1]?.targetLanguage ||
                    (meeting_target_lang !== 'Auto'
                      ? meeting_target_lang
                      : target_language || 'Indonesian')}
              </span>
              <span>
                {interim_speech_text
                  ? (interim_translation_source_ref.current ===
                    String(interim_speech_text).trim()
                      ? interim_translated_text
                      : '') ||
                    (is_interim_translating
                      ? 'Translating live speech...'
                      : 'Waiting for phrase to translate...')
                  : last_live_caption?.translatedText ||
                    meeting_turns[meeting_turns.length - 1]?.translatedText ||
                    'Live translation will appear here automatically as you speak.'}
              </span>
            </div>
          </div>

          {/* Multi-Speaker Live Conversation Log */}
          {meeting_turns.length > 0 && (
            <div
              ref={meeting_feed_ref}
              className={styles['lumen-sound-meeting-feed']}
            >
              {[...meeting_turns].reverse().map((turn, idx) => {
                const letter = get_speaker_letter_suffix(turn.speakerRole, idx);
                const turn_card_cls =
                  styles[`lumen-sound-turn-card-${letter}`] ||
                  styles['lumen-sound-turn-card-a'];
                const show_translation = Boolean(
                  turn.translatedText && String(turn.translatedText).trim()
                );
                return (
                  <div
                    key={turn.id}
                    className={`${styles['lumen-sound-turn-card']} ${turn_card_cls}`}
                  >
                    <div className={styles['lumen-sound-turn-meta']}>
                      <button
                        type="button"
                        className={styles['lumen-sound-turn-speaker-chip']}
                        onClick={() => handle_cycle_turn_speaker(turn.id)}
                        title="Click to cycle/reassign speaker for this turn"
                      >
                        <span>{turn.speakerName}</span>
                        <span style={{ opacity: 0.7, fontWeight: 500 }}>
                          ({turn.sourceLanguage}
                          {show_translation ? ` → ${turn.targetLanguage}` : ''}) ↻
                        </span>
                      </button>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>{turn.timestamp}</span>
                        {turn.translatedText && (
                          <button
                            type="button"
                            className={styles['lumen-sound-icon-link']}
                            style={{ padding: 0 }}
                            onClick={() =>
                              speak_translated_utterance(
                                turn.translatedText,
                                turn.targetLanguage
                              )
                            }
                            title={`Play ${turn.targetLanguage} audio aloud`}
                          >
                            <Volume2 size={11} />
                          </button>
                        )}
                      </span>
                    </div>
                    <div className={styles['lumen-sound-turn-original']}>
                      {turn.transcript}
                    </div>
                    {show_translation && (
                      <div className={styles['lumen-sound-turn-translated']}>
                        {turn.translatedText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STANDARD VOICE RECORDER STAGE */}
      {!is_live_meeting_mode && (
        <div className={styles['lumen-sound-recorder-stage']}>
          <div className={styles['lumen-sound-waveform-row']} aria-hidden="true">
            {wave_levels.map((lvl, idx) => (
              <div
                key={idx}
                className={`${styles['lumen-sound-wave-bar']} ${
                  is_recording ? styles['lumen-sound-wave-bar-active'] : ''
                }`}
                style={{
                  height: `${is_recording ? lvl : 18}%`,
                }}
              />
            ))}
          </div>

          <div className={styles['lumen-sound-controls-row']}>
            {!is_recording ? (
              <button
                type="button"
                className={styles['lumen-sound-primary-btn']}
                onClick={(e) => handle_start_recording(e, false)}
                disabled={is_requesting || is_uploading}
              >
                {is_requesting || is_uploading ? (
                  <Loader2 size={14} className={styles['lumen-sound-spin']} />
                ) : (
                  <Mic size={14} />
                )}
                <span>
                  {is_requesting
                    ? 'Allow Microphone...'
                    : is_uploading
                    ? `Uploading ${upload_progress || 0}%...`
                    : resolved_audio_src
                    ? 'Record New'
                    : 'Start Recording'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                className={`${styles['lumen-sound-primary-btn']} ${styles['lumen-sound-stop-btn']}`}
                onClick={handle_stop_recording}
              >
                <Square size={13} fill="currentColor" />
                <span>Stop & Upload</span>
              </button>
            )}

            <button
              type="button"
              className={styles['lumen-sound-secondary-btn']}
              onClick={() => file_input_ref.current?.click()}
              disabled={is_recording || is_uploading}
              title="Upload an existing audio file to the file server"
            >
              <Upload size={13} />
              <span>Upload File</span>
            </button>
          </div>
        </div>
      )}

      <input
        ref={file_input_ref}
        type="file"
        accept="audio/*"
        className={styles['lumen-sound-hidden-input']}
        onChange={handle_file_upload_change}
      />

      {/* Recorded Audio Playback Box (Streamed from File Server) */}
      {!is_live_meeting_mode && resolved_audio_src && (
        <div className={styles['lumen-sound-player-box']}>
          <audio
            ref={audio_player_ref}
            controls
            preload="metadata"
            src={resolved_audio_src}
            onLoadedMetadata={handle_audio_metadata_duration_fix}
            onDurationChange={(e) => {
              const el = e?.currentTarget;
              if (
                el &&
                Number.isFinite(el.duration) &&
                el.duration > 0 &&
                el.currentTime > el.duration
              ) {
                el.currentTime = 0;
              }
            }}
            className={styles['lumen-sound-audio-element']}
          />
          <div className={styles['lumen-sound-player-meta']}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                maxWidth: '64%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={card?.file_name || 'Voice Recording'}
            >
              {is_stored_on_server ? (
                <Cloud size={12} color="#059669" />
              ) : (
                <Volume2 size={12} />
              )}
              <span>{card?.file_name || 'Voice Recording'}</span>
              {card?.file_size ? (
                <span style={{ opacity: 0.75 }}>
                  ({format_audio_bytes(card.file_size)})
                </span>
              ) : null}
            </span>

            <div className={styles['lumen-sound-meta-actions']}>
              <a
                href={server_download_url || resolved_audio_src}
                download={card?.file_name || 'voice-recording.webm'}
                className={styles['lumen-sound-icon-link']}
              >
                <Download size={12} />
                Download
              </a>
              <button
                type="button"
                className={styles['lumen-sound-icon-link']}
                style={{ color: '#dc2626' }}
                onClick={handle_clear_recording}
                title="Delete recording from file server"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Transcribe & Translate Toolbar */}
      <div className={styles['lumen-sound-ai-toolbar']}>
        <div className={styles['lumen-sound-ai-btn-group']}>
          <button
            type="button"
            className={styles['lumen-sound-ai-btn']}
            disabled={
              (!resolved_audio_src &&
                !pending_audio_blob?.blob &&
                !transcript_text.trim()) ||
              is_ai_busy ||
              is_recording ||
              is_uploading
            }
            onClick={() => handle_ai_process('transcribe')}
          >
            {is_ai_busy ? (
              <Loader2 size={12} className={styles['lumen-sound-spin']} />
            ) : (
              <Sparkles size={12} />
            )}
            <span>Transcribe</span>
          </button>

          <button
            type="button"
            className={styles['lumen-sound-ai-btn']}
            disabled={
              (!resolved_audio_src &&
                !pending_audio_blob?.blob &&
                !transcript_text.trim()) ||
              is_ai_busy ||
              is_recording ||
              is_uploading
            }
            onClick={() =>
              handle_ai_process(
                transcript_text.trim() ? 'translate' : 'both'
              )
            }
          >
            <Languages size={12} />
            <span>Translate</span>
          </button>

          <button
            type="button"
            className={styles['lumen-sound-ai-btn']}
            disabled={
              (!resolved_audio_src &&
                !pending_audio_blob?.blob &&
                !transcript_text.trim() &&
                meeting_turns.length === 0) ||
              is_ai_busy ||
              is_recording ||
              is_uploading
            }
            onClick={handle_create_rich_note_card}
            title="Create a rich companion Note card with recording summary & [MM:SS] key points, and automatically create a Checklist card if there are tasks to do"
          >
            <FileText size={12} />
            <span>Create Note</span>
          </button>
        </div>

        <select
          className={styles['lumen-sound-lang-select']}
          value={target_language}
          onChange={(e) => {
            updateCard(card.id, { target_language: e.target.value }, true);
            saveCurrentBoardToStore({ immediate: true });
          }}
          title="Target translation language"
        >
          {LUMEN_SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>

      {ai_status_text && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: '#2563eb',
            fontWeight: 600,
          }}
        >
          <Loader2 size={12} className={styles['lumen-sound-spin']} />
          <span>{ai_status_text}</span>
          {is_ai_busy && (
            <span
              style={{
                marginLeft: 'auto',
                padding: '1px 6px',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                background: 'rgba(37, 99, 235, 0.14)',
                border: '1px solid rgba(37, 99, 235, 0.28)',
                color: '#1d4ed8',
              }}
              title="AI elapsed running time"
            >
              {formatAiElapsedTime(ai_busy_elapsed_sec)}
            </span>
          )}
        </div>
      )}

      {/* Transcript Section (with [MM:SS] Timestamps) — shown in Voice Recorder mode */}
      {!is_live_meeting_mode && (
        <div className={styles['lumen-sound-text-section']}>
          <div className={styles['lumen-sound-text-header']}>
            <span>Transcript (Timestamped)</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                fontWeight: 500,
                textTransform: 'none',
              }}
            >
              {detected_speaker_count > 0 && (
                <span
                  style={{
                    color: '#4338ca',
                    fontWeight: 700,
                    background: 'rgba(99, 102, 241, 0.1)',
                    padding: '1px 6px',
                    borderRadius: 999,
                  }}
                >
                  {detected_speaker_count}{' '}
                  {detected_speaker_count === 1 ? 'Person' : 'People'} in Voice
                </span>
              )}
            </span>
          </div>
          <div className={styles['lumen-sound-timestamp-segments-box']}>
            {transcript_segments.length > 0 ? (
              transcript_segments.map((seg) => (
                <div
                  key={seg.id}
                  className={styles['lumen-sound-timestamp-segment-row']}
                >
                  <button
                    type="button"
                    className={styles['lumen-sound-timestamp-chip']}
                    onClick={() => handle_seek_audio_to_seconds(seg.seconds)}
                    title={`Jump audio playback to [${seg.timestampLabel}]`}
                  >
                    [{seg.timestampLabel}]
                  </button>
                  <span className={styles['lumen-sound-timestamp-segment-text']}>
                    {seg.text}
                  </span>
                </div>
              ))
            ) : (
              <div className={styles['lumen-sound-timestamp-empty']}>
                [00:00] Record or upload audio and click Transcribe...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Translation Section (with [MM:SS] Timestamps) — shown in Voice Recorder mode */}
      {!is_live_meeting_mode && translated_text ? (
        <div className={styles['lumen-sound-text-section']}>
          <div className={styles['lumen-sound-text-header']}>
            <span>Translation ({target_language} · Timestamped)</span>
            <CheckCircle2 size={12} color="#10b981" />
          </div>
          {translated_segments.length > 0 && (
            <div className={styles['lumen-sound-timestamp-segments-box']}>
              {translated_segments.map((seg) => (
                <div
                  key={seg.id}
                  className={styles['lumen-sound-timestamp-segment-row']}
                >
                  <button
                    type="button"
                    className={`${styles['lumen-sound-timestamp-chip']} ${styles['lumen-sound-timestamp-chip-translated']}`}
                    onClick={() => handle_seek_audio_to_seconds(seg.seconds)}
                    title={`Jump audio playback to [${seg.timestampLabel}]`}
                  >
                    [{seg.timestampLabel}]
                  </button>
                  <span className={styles['lumen-sound-timestamp-segment-text']}>
                    {seg.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* On-demand Microphone Access Request Popup (only shown when user tries to record without permission) */}
      {show_mic_permission_popup &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={styles['lumen-sound-mic-popup-overlay']}
            onClick={() => set_show_mic_permission_popup(false)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className={styles['lumen-sound-mic-popup-dialog']}
              role="dialog"
              aria-modal="true"
              aria-labelledby="lumen-mic-popup-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles['lumen-sound-mic-popup-header']}>
                <h3
                  id="lumen-mic-popup-title"
                  className={styles['lumen-sound-mic-popup-title']}
                >
                  <Mic size={16} color="#dc2626" />
                  <span>Microphone access request</span>
                </h3>
                <button
                  type="button"
                  className={styles['lumen-sound-mic-popup-close-btn']}
                  onClick={() => set_show_mic_permission_popup(false)}
                  aria-label="close"
                  title="Close"
                >
                  <X size={15} />
                </button>
              </div>
              <p className={styles['lumen-sound-mic-popup-body']}>
                This app requests access to Microphone to work properly. Do you
                want to allow Microphone access?
              </p>
              {permission_error ? (
                <div className={styles['lumen-sound-mic-popup-error-note']}>
                  {permission_error}
                </div>
              ) : null}
              <div className={styles['lumen-sound-mic-popup-actions']}>
                <button
                  type="button"
                  className={styles['lumen-sound-secondary-btn']}
                  onClick={() => set_show_mic_permission_popup(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles['lumen-sound-primary-btn']}
                  onClick={(e) =>
                    handle_start_recording(e, pending_live_meeting_start, true)
                  }
                >
                  <Mic size={13} />
                  <span>Allow Microphone Access</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
