import { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  RotateCcw,
  RefreshCw,
  Play,
  Pause,
  Grid,
  Maximize2,
  Box,
  Layers,
  Sparkles,
  Eye,
  Camera,
  Upload,
  ChevronDown,
  ChevronUp,
  User,
  Gauge,
  Plus,
} from 'lucide-react';

import styles from './LUMEN_3d_canvas_preview.module.css';

const BUILTIN_ANIMATIONS = [
  { id: 'idle', label: 'Idle' },
  { id: 'walk', label: 'Walk' },
  { id: 'run', label: 'Run' },
  { id: 'jump', label: 'Jump' },
  { id: 'wave', label: 'Wave' },
  { id: 'spin', label: 'Spin' },
  { id: 'dance', label: 'Dance' },
  { id: 'attack', label: 'Attack' },
  { id: 'crouch', label: 'Crouch' },
  { id: 'salute', label: 'Salute' },
];

const CHARACTER_SKINS = [
  { id: 'cyber', label: 'Cyber Blue', primary: 0x2563eb, secondary: 0x1e293b, accent: 0x38bdf8 },
  { id: 'crimson', label: 'Crimson Mecha', primary: 0xe11d48, secondary: 0x1f2937, accent: 0xfbbf24 },
  { id: 'emerald', label: 'Emerald Scout', primary: 0x059669, secondary: 0x0f172a, accent: 0x34d399 },
  { id: 'paladin', label: 'Gold Paladin', primary: 0xd97706, secondary: 0xf8fafc, accent: 0x60a5fa },
];

const SPEED_OPTIONS = [0.5, 1, 1.5, 2];

/**
 * Creates a soft radial contact shadow texture on an HTML5 2D canvas
 */
function create_contact_shadow_texture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.52)');
    grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.22)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const FALLBACK_TEXTURE_CACHE = {};

/**
 * Generates a valid 4x4 studio fallback PNG data URL for external relative textures
 * (e.g., textures/1.kawa_baseColor.jpeg) when a standalone .gltf or .fbx is uploaded
 * without its external texture folder, preventing THREE.GLTFLoader 404 console errors.
 */
function get_fallback_studio_texture_data_url(raw_url = '') {
  const lower = String(raw_url || '').toLowerCase();
  let kind = 'base';
  if (lower.includes('normal') || lower.includes('bump') || lower.includes('nrm')) {
    kind = 'normal';
  } else if (lower.includes('emissive') || lower.includes('emit')) {
    kind = 'emissive';
  } else if (lower.includes('metal') || lower.includes('rough') || lower.includes('orm')) {
    kind = 'orm';
  }

  if (FALLBACK_TEXTURE_CACHE[kind]) {
    return FALLBACK_TEXTURE_CACHE[kind];
  }

  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    if (kind === 'normal') {
      ctx.fillStyle = '#8080ff'; // Flat tangent-space normal
    } else if (kind === 'emissive') {
      ctx.fillStyle = '#000000'; // Zero emission
    } else if (kind === 'orm') {
      ctx.fillStyle = '#ffdf00'; // AO=1, Roughness=0.87, Metalness=0.0
    } else {
      ctx.fillStyle = '#ffffff'; // Pure neutral multiplier so material baseColorFactor is preserved 1:1
    }
    ctx.fillRect(0, 0, 4, 4);
  }
  const data_url = canvas.toDataURL('image/png');
  FALLBACK_TEXTURE_CACHE[kind] = data_url;
  return data_url;
}

/**
 * Creates a THREE.LoadingManager that intercepts relative external texture/resource paths
 * (such as "textures/1.kawa_baseColor.jpeg") and maps them to user-uploaded companion files
 * or a valid in-memory studio fallback texture so GLTFLoader/FBXLoader never fail on 404 textures.
 */
function create_safe_3d_loading_manager(primary_model_url = '', companion_files_map = null) {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (!url || typeof url !== 'string') return url;
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (primary_model_url && url === primary_model_url) return url;

    const clean_path = decodeURIComponent(url.split('?')[0]);
    const file_basename = (clean_path.split('/').pop() || '').toLowerCase();

    if (companion_files_map && file_basename && companion_files_map.has(file_basename)) {
      return companion_files_map.get(file_basename);
    }

    const is_image_ref =
      /\.(jpe?g|png|webp|bmp|gif|tga|dds|ktx2|hdr|exr|tif?f)$/i.test(clean_path) ||
      clean_path.toLowerCase().includes('textures/');

    if (is_image_ref) {
      return get_fallback_studio_texture_data_url(file_basename || clean_path);
    }

    return url;
  });
  return manager;
}

/**
 * Retargets an imported THREE.AnimationClip (from Mixamo FBX, GLB, GLTF, BVH, or JSON)
 * onto the active character model's bone/node hierarchy so separate animation files
 * can drive both custom rigged characters and the built-in articulated character rig.
 */
function retarget_clip_to_model(clip, model_obj) {
  if (!clip || !model_obj) return clip;

  const node_by_exact = new Map();
  const node_by_clean = new Map();
  const clean_bone_key = (raw) =>
    String(raw || '')
      .replace(/^.*[:|]/, '')
      .replace(/^mixamorig/i, '')
      .replace(/[_\-\s]/g, '')
      .toLowerCase();

  model_obj.traverse((node) => {
    if (node.name) {
      node_by_exact.set(node.name, node.name);
      node_by_clean.set(clean_bone_key(node.name), node.name);
    }
  });

  const humanoid_aliases = {
    hips: 'Hips',
    pelvis: 'Hips',
    root: 'Hips',
    spine: 'Spine',
    spine1: 'Spine',
    spine2: 'Spine',
    chest: 'Spine',
    upperchest: 'Spine',
    torso: 'Spine',
    neck: 'Head',
    head: 'Head',
    leftarm: 'LeftArm',
    leftuparm: 'LeftArm',
    leftupperarm: 'LeftArm',
    lupperarm: 'LeftArm',
    leftforearm: 'LeftForeArm',
    leftlowerarm: 'LeftForeArm',
    llowerarm: 'LeftForeArm',
    rightarm: 'RightArm',
    rightuparm: 'RightArm',
    rightupperarm: 'RightArm',
    rupperarm: 'RightArm',
    rightforearm: 'RightForeArm',
    rightlowerarm: 'RightForeArm',
    rlowerarm: 'RightForeArm',
    leftupleg: 'LeftUpLeg',
    leftthigh: 'LeftUpLeg',
    lthigh: 'LeftUpLeg',
    leftleg: 'LeftLeg',
    leftshin: 'LeftLeg',
    lcalf: 'LeftLeg',
    rightupleg: 'RightUpLeg',
    rightthigh: 'RightUpLeg',
    rthigh: 'RightUpLeg',
    rightleg: 'RightLeg',
    rightshin: 'RightLeg',
    rcalf: 'RightLeg',
  };

  const remapped_tracks = [];
  for (const track of clip.tracks || []) {
    const dot_idx = track.name.lastIndexOf('.');
    if (dot_idx === -1) {
      remapped_tracks.push(track);
      continue;
    }
    const raw_node = track.name.slice(0, dot_idx).replace(/^\.bones\[['"]?|['"]?\]$/g, '');
    const prop_name = track.name.slice(dot_idx + 1);

    if (prop_name === 'position' && model_obj.userData?.rig_joints) {
      continue;
    }

    let resolved_node = node_by_exact.get(raw_node);
    if (!resolved_node) {
      const cleaned = clean_bone_key(raw_node);
      resolved_node = node_by_clean.get(cleaned);
      if (!resolved_node && humanoid_aliases[cleaned]) {
        const alias_target = humanoid_aliases[cleaned];
        resolved_node = node_by_exact.get(alias_target) || node_by_clean.get(clean_bone_key(alias_target));
      }
    }

    if (resolved_node) {
      const cloned_track = track.clone();
      cloned_track.name = `${resolved_node}.${prop_name}`;
      remapped_tracks.push(cloned_track);
    } else {
      remapped_tracks.push(track);
    }
  }

  return new THREE.AnimationClip(clip.name || 'Custom_Anim', clip.duration, remapped_tracks);
}

/**
 * Builds an articulated 12-part procedural 3D character rig (THREE.Group)
 * with named humanoid joints for Idle, Walk, Run, Jump, Wave, Spin, Dance, Attack, Crouch, Salute, and custom clips.
 */
function build_articulated_character_rig(skin_id = 'cyber') {
  const skin = CHARACTER_SKINS.find((s) => s.id === skin_id) || CHARACTER_SKINS[0];
  const root_group = new THREE.Group();
  root_group.name = 'lumen_character_root';

  const armor_mat = new THREE.MeshStandardMaterial({
    color: skin.primary,
    roughness: 0.32,
    metalness: 0.55,
  });
  const joint_mat = new THREE.MeshStandardMaterial({
    color: skin.secondary,
    roughness: 0.65,
    metalness: 0.25,
  });
  const trim_mat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.8,
  });
  const visor_mat = new THREE.MeshStandardMaterial({
    color: skin.accent,
    emissive: skin.accent,
    emissiveIntensity: 0.85,
    roughness: 0.15,
    metalness: 0.1,
  });

  // Pelvis / Root Hip Pivot
  const pelvis_pivot = new THREE.Group();
  pelvis_pivot.name = 'Hips';
  pelvis_pivot.position.set(0, 1.05, 0);
  root_group.add(pelvis_pivot);

  const pelvis_mesh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.24, 0.36), joint_mat);
  pelvis_mesh.castShadow = true;
  pelvis_mesh.receiveShadow = true;
  pelvis_pivot.add(pelvis_mesh);

  const belt_buckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.4), visor_mat);
  pelvis_pivot.add(belt_buckle);

  // Torso Pivot
  const torso_pivot = new THREE.Group();
  torso_pivot.name = 'Spine';
  torso_pivot.position.set(0, 0.14, 0);
  pelvis_pivot.add(torso_pivot);

  const torso_core = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.72, 0.42), armor_mat);
  torso_core.position.set(0, 0.38, 0);
  torso_core.castShadow = true;
  torso_core.receiveShadow = true;
  torso_pivot.add(torso_core);

  // Chest Plate & Emblem
  const chest_plate = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 0.48), trim_mat);
  chest_plate.position.set(0, 0.46, 0.02);
  chest_plate.castShadow = true;
  torso_pivot.add(chest_plate);

  const chest_core = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 20), visor_mat);
  chest_core.rotation.x = Math.PI / 2;
  chest_core.position.set(0, 0.48, 0.25);
  torso_pivot.add(chest_core);

  // Backpack Jetpack Unit
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.24), joint_mat);
  backpack.position.set(0, 0.42, -0.28);
  backpack.castShadow = true;
  torso_pivot.add(backpack);

  const thruster_l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.16, 16), trim_mat);
  thruster_l.position.set(-0.13, 0.12, -0.28);
  torso_pivot.add(thruster_l);

  const thruster_r = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.16, 16), trim_mat);
  thruster_r.position.set(0.13, 0.12, -0.28);
  torso_pivot.add(thruster_r);

  // Head & Helmet Pivot
  const head_pivot = new THREE.Group();
  head_pivot.name = 'Head';
  head_pivot.position.set(0, 0.78, 0);
  torso_pivot.add(head_pivot);

  const neck_mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.14, 16), joint_mat);
  neck_mesh.position.set(0, 0.05, 0);
  head_pivot.add(neck_mesh);

  const helmet_mesh = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.48, 0.52), armor_mat);
  helmet_mesh.position.set(0, 0.32, 0);
  helmet_mesh.castShadow = true;
  helmet_mesh.receiveShadow = true;
  head_pivot.add(helmet_mesh);

  const visor_mesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.06), visor_mat);
  visor_mesh.position.set(0, 0.33, 0.25);
  head_pivot.add(visor_mesh);

  const crest_mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.56), trim_mat);
  crest_mesh.position.set(0, 0.58, 0);
  head_pivot.add(crest_mesh);

  const ear_l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16), trim_mat);
  ear_l.rotation.z = Math.PI / 2;
  ear_l.position.set(-0.29, 0.32, 0);
  head_pivot.add(ear_l);

  const ear_r = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16), trim_mat);
  ear_r.rotation.z = Math.PI / 2;
  ear_r.position.set(0.29, 0.32, 0);
  head_pivot.add(ear_r);

  const build_arm = (side_sign, arm_name, forearm_name) => {
    const shoulder_pivot = new THREE.Group();
    shoulder_pivot.name = arm_name;
    shoulder_pivot.position.set(side_sign * 0.46, 0.66, 0);
    torso_pivot.add(shoulder_pivot);

    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.28), armor_mat);
    pauldron.position.set(side_sign * 0.04, 0.02, 0);
    pauldron.castShadow = true;
    shoulder_pivot.add(pauldron);

    const upper_arm = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.38, 16), joint_mat);
    upper_arm.position.set(side_sign * 0.05, -0.2, 0);
    upper_arm.castShadow = true;
    shoulder_pivot.add(upper_arm);

    const elbow_pivot = new THREE.Group();
    elbow_pivot.name = forearm_name;
    elbow_pivot.position.set(side_sign * 0.05, -0.4, 0);
    shoulder_pivot.add(elbow_pivot);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.2), armor_mat);
    forearm.position.set(0, -0.18, 0);
    forearm.castShadow = true;
    elbow_pivot.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), trim_mat);
    hand.position.set(0, -0.4, 0);
    hand.castShadow = true;
    elbow_pivot.add(hand);

    return { shoulder_pivot, elbow_pivot };
  };

  const left_arm = build_arm(-1, 'LeftArm', 'LeftForeArm');
  const right_arm = build_arm(1, 'RightArm', 'RightForeArm');

  const build_leg = (side_sign, up_leg_name, leg_name) => {
    const hip_pivot = new THREE.Group();
    hip_pivot.name = up_leg_name;
    hip_pivot.position.set(side_sign * 0.19, -0.08, 0);
    pelvis_pivot.add(hip_pivot);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.46, 0.26), armor_mat);
    thigh.position.set(0, -0.24, 0);
    thigh.castShadow = true;
    thigh.receiveShadow = true;
    hip_pivot.add(thigh);

    const knee_pivot = new THREE.Group();
    knee_pivot.name = leg_name;
    knee_pivot.position.set(0, -0.48, 0);
    hip_pivot.add(knee_pivot);

    const knee_pad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.28), trim_mat);
    knee_pad.position.set(0, 0, 0.03);
    knee_pivot.add(knee_pad);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.42, 0.23), joint_mat);
    shin.position.set(0, -0.22, 0);
    shin.castShadow = true;
    knee_pivot.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.38), armor_mat);
    boot.position.set(0, -0.41, 0.06);
    boot.castShadow = true;
    boot.receiveShadow = true;
    knee_pivot.add(boot);

    return { hip_pivot, knee_pivot };
  };

  const left_leg = build_leg(-1, 'LeftUpLeg', 'LeftLeg');
  const right_leg = build_leg(1, 'RightUpLeg', 'RightLeg');

  root_group.userData.rig_joints = {
    pelvis_pivot,
    torso_pivot,
    head_pivot,
    left_shoulder: left_arm.shoulder_pivot,
    left_elbow: left_arm.elbow_pivot,
    right_shoulder: right_arm.shoulder_pivot,
    right_elbow: right_arm.elbow_pivot,
    left_hip: left_leg.hip_pivot,
    left_knee: left_leg.knee_pivot,
    right_hip: right_leg.hip_pivot,
    right_knee: right_leg.knee_pivot,
    base_pelvis_y: 1.05,
  };

  return root_group;
}

/**
 * Evaluates procedural character animations (Idle, Walk, Run, Jump, Wave, Spin, Dance, Attack, Crouch, Salute)
 * on both the articulated 12-part rig AND any imported static 3D model.
 */
function evaluate_procedural_animation(model_obj, anim_id, elapsed_time, contact_shadow_mesh) {
  if (!model_obj) return;
  const joints = model_obj.userData?.rig_joints;

  if (!joints) {
    const base_y = model_obj.userData.base_floor_y || 0;
    if (anim_id === 'walk') {
      const t = elapsed_time * 5.5;
      model_obj.position.y = base_y + Math.abs(Math.sin(t)) * 0.14;
      model_obj.rotation.z = Math.sin(t) * 0.08;
      model_obj.rotation.x = 0.06;
    } else if (anim_id === 'run') {
      const t = elapsed_time * 9.5;
      model_obj.position.y = base_y + Math.abs(Math.sin(t)) * 0.26;
      model_obj.rotation.z = Math.sin(t) * 0.12;
      model_obj.rotation.x = 0.18;
    } else if (anim_id === 'jump') {
      const cycle = (elapsed_time * 1.4) % 1;
      const jump_arc = cycle < 0.7 ? Math.sin((cycle / 0.7) * Math.PI) : 0;
      model_obj.position.y = base_y + jump_arc * 1.05;
      model_obj.rotation.x = cycle < 0.7 ? Math.sin((cycle / 0.7) * Math.PI * 2) * 0.15 : 0;
      model_obj.rotation.z = 0;
    } else if (anim_id === 'spin') {
      model_obj.position.y = base_y + Math.sin(elapsed_time * 4) * 0.1;
      model_obj.rotation.y = elapsed_time * 4.5;
    } else if (anim_id === 'dance') {
      const t = elapsed_time * 6.0;
      model_obj.position.y = base_y + Math.abs(Math.sin(t)) * 0.22;
      model_obj.rotation.y = Math.sin(t * 0.5) * 0.45;
      model_obj.rotation.z = Math.cos(t) * 0.14;
    } else if (anim_id === 'attack') {
      const t = elapsed_time * 4.5;
      model_obj.position.y = base_y;
      model_obj.rotation.x = Math.sin(t) * 0.25;
    } else if (anim_id === 'crouch') {
      model_obj.position.y = base_y - 0.18 + Math.sin(elapsed_time * 2) * 0.03;
      model_obj.rotation.x = 0.12;
    } else {
      model_obj.position.y = base_y + Math.sin(elapsed_time * 2.2) * 0.05;
      model_obj.rotation.x = 0;
      model_obj.rotation.z = 0;
    }
    return;
  }

  const {
    pelvis_pivot,
    torso_pivot,
    head_pivot,
    left_shoulder,
    left_elbow,
    right_shoulder,
    right_elbow,
    left_hip,
    left_knee,
    right_hip,
    right_knee,
    base_pelvis_y,
  } = joints;

  pelvis_pivot.rotation.set(0, 0, 0);
  torso_pivot.rotation.set(0, 0, 0);
  head_pivot.rotation.set(0, 0, 0);
  left_shoulder.rotation.set(0, 0, 0);
  left_elbow.rotation.set(0, 0, 0);
  right_shoulder.rotation.set(0, 0, 0);
  right_elbow.rotation.set(0, 0, 0);
  left_hip.rotation.set(0, 0, 0);
  left_knee.rotation.set(0, 0, 0);
  right_hip.rotation.set(0, 0, 0);
  right_knee.rotation.set(0, 0, 0);

  let shadow_scale = 1.0;

  if (anim_id === 'walk') {
    const t = elapsed_time * 5.2;
    const stride = Math.sin(t);
    const counter = Math.sin(t + Math.PI);

    pelvis_pivot.position.y = base_pelvis_y + Math.abs(Math.cos(t)) * 0.07;
    pelvis_pivot.rotation.y = stride * 0.12;
    pelvis_pivot.rotation.z = Math.cos(t) * 0.04;

    torso_pivot.rotation.x = 0.08;
    torso_pivot.rotation.y = -stride * 0.14;
    head_pivot.rotation.y = stride * 0.08;

    left_hip.rotation.x = stride * 0.62;
    left_knee.rotation.x = Math.max(0, -stride) * 0.78 + 0.08;

    right_hip.rotation.x = counter * 0.62;
    right_knee.rotation.x = Math.max(0, -counter) * 0.78 + 0.08;

    left_shoulder.rotation.x = counter * 0.52;
    left_shoulder.rotation.z = 0.08;
    left_elbow.rotation.x = -0.32 - Math.max(0, counter) * 0.25;

    right_shoulder.rotation.x = stride * 0.52;
    right_shoulder.rotation.z = -0.08;
    right_elbow.rotation.x = -0.32 - Math.max(0, stride) * 0.25;
  } else if (anim_id === 'run') {
    const t = elapsed_time * 9.6;
    const stride = Math.sin(t);
    const counter = Math.sin(t + Math.PI);

    const bounce = Math.abs(Math.cos(t)) * 0.16;
    pelvis_pivot.position.y = base_pelvis_y + bounce - 0.04;
    pelvis_pivot.rotation.y = stride * 0.22;
    pelvis_pivot.rotation.x = 0.14;

    torso_pivot.rotation.x = 0.24;
    torso_pivot.rotation.y = -stride * 0.25;
    head_pivot.rotation.x = -0.18;
    head_pivot.rotation.y = stride * 0.12;

    left_hip.rotation.x = stride * 1.05;
    left_knee.rotation.x = Math.max(0, -stride) * 1.35 + 0.18;

    right_hip.rotation.x = counter * 1.05;
    right_knee.rotation.x = Math.max(0, -counter) * 1.35 + 0.18;

    left_shoulder.rotation.x = counter * 0.95;
    left_shoulder.rotation.z = 0.12;
    left_elbow.rotation.x = -1.15;

    right_shoulder.rotation.x = stride * 0.95;
    right_shoulder.rotation.z = -0.12;
    right_elbow.rotation.x = -1.15;

    shadow_scale = 1.0 - bounce * 1.2;
  } else if (anim_id === 'jump') {
    const phase = (elapsed_time * 0.95) % 1;

    if (phase < 0.22) {
      const p = Math.sin((phase / 0.22) * (Math.PI / 2));
      pelvis_pivot.position.y = base_pelvis_y - p * 0.26;
      torso_pivot.rotation.x = p * 0.32;
      head_pivot.rotation.x = -p * 0.2;
      left_hip.rotation.x = -p * 0.65;
      left_knee.rotation.x = p * 1.25;
      right_hip.rotation.x = -p * 0.65;
      right_knee.rotation.x = p * 1.25;
      left_shoulder.rotation.x = p * 0.55;
      right_shoulder.rotation.x = p * 0.55;
      left_elbow.rotation.x = -p * 0.6;
      right_elbow.rotation.x = -p * 0.6;
      shadow_scale = 1.08;
    } else if (phase < 0.78) {
      const air_t = (phase - 0.22) / 0.56;
      const arc = Math.sin(air_t * Math.PI);
      pelvis_pivot.position.y = base_pelvis_y + arc * 0.95;
      torso_pivot.rotation.x = -arc * 0.12;
      head_pivot.rotation.x = -arc * 0.15;

      left_hip.rotation.x = -arc * 0.55;
      left_knee.rotation.x = arc * 0.95;
      right_hip.rotation.x = -arc * 0.35;
      right_knee.rotation.x = arc * 0.75;

      left_shoulder.rotation.x = -arc * 2.4;
      left_shoulder.rotation.z = arc * 0.35;
      right_shoulder.rotation.x = -arc * 2.4;
      right_shoulder.rotation.z = -arc * 0.35;
      left_elbow.rotation.x = -0.25;
      right_elbow.rotation.x = -0.25;
      shadow_scale = Math.max(0.45, 1.0 - arc * 0.5);
    } else {
      const rec_t = (phase - 0.78) / 0.22;
      const absorb = Math.sin(rec_t * Math.PI);
      pelvis_pivot.position.y = base_pelvis_y - absorb * 0.2;
      torso_pivot.rotation.x = absorb * 0.25;
      left_hip.rotation.x = -absorb * 0.5;
      left_knee.rotation.x = absorb * 0.95;
      right_hip.rotation.x = -absorb * 0.5;
      right_knee.rotation.x = absorb * 0.95;
      left_shoulder.rotation.z = absorb * 0.3;
      right_shoulder.rotation.z = -absorb * 0.3;
      shadow_scale = 1.05;
    }
  } else if (anim_id === 'wave') {
    const t = elapsed_time * 3.0;
    pelvis_pivot.position.y = base_pelvis_y + Math.sin(t) * 0.03;
    torso_pivot.rotation.z = -0.06;
    head_pivot.rotation.z = 0.1;
    head_pivot.rotation.y = Math.sin(t * 0.8) * 0.12;

    right_shoulder.rotation.x = -2.35;
    right_shoulder.rotation.z = -0.35 + Math.sin(elapsed_time * 8.5) * 0.28;
    right_elbow.rotation.x = -0.45 + Math.cos(elapsed_time * 8.5) * 0.35;

    left_shoulder.rotation.z = 0.22;
    left_elbow.rotation.x = -0.35;
  } else if (anim_id === 'spin') {
    const t = elapsed_time * 4.2;
    pelvis_pivot.position.y = base_pelvis_y + Math.abs(Math.sin(t)) * 0.18;
    pelvis_pivot.rotation.y = t;
    torso_pivot.rotation.x = 0.12;
    left_shoulder.rotation.z = 1.15;
    right_shoulder.rotation.z = -1.15;
    left_elbow.rotation.x = -0.4;
    right_elbow.rotation.x = -0.4;
    left_hip.rotation.x = -0.25;
    left_knee.rotation.x = 0.45;
    right_hip.rotation.x = 0.2;
    right_knee.rotation.x = 0.25;
  } else if (anim_id === 'dance') {
    const t = elapsed_time * 6.2;
    const beat = Math.sin(t);
    const half_beat = Math.sin(t * 0.5);
    pelvis_pivot.position.y = base_pelvis_y + Math.abs(beat) * 0.12 - 0.06;
    pelvis_pivot.rotation.z = half_beat * 0.16;
    pelvis_pivot.rotation.y = half_beat * 0.28;
    torso_pivot.rotation.z = -half_beat * 0.18;
    torso_pivot.rotation.x = Math.abs(beat) * 0.14;
    head_pivot.rotation.y = -half_beat * 0.25;
    head_pivot.rotation.z = beat * 0.12;

    left_shoulder.rotation.x = -1.4 + beat * 0.65;
    left_shoulder.rotation.z = 0.45;
    left_elbow.rotation.x = -0.85 + Math.cos(t) * 0.4;

    right_shoulder.rotation.x = -1.4 - beat * 0.65;
    right_shoulder.rotation.z = -0.45;
    right_elbow.rotation.x = -0.85 - Math.cos(t) * 0.4;

    left_hip.rotation.x = Math.max(0, beat) * 0.55 - 0.15;
    left_knee.rotation.x = Math.max(0, beat) * 0.85 + 0.2;
    right_hip.rotation.x = Math.max(0, -beat) * 0.55 - 0.15;
    right_knee.rotation.x = Math.max(0, -beat) * 0.85 + 0.2;
  } else if (anim_id === 'attack') {
    const cycle = (elapsed_time * 1.5) % 1;
    const strike = cycle < 0.35
      ? -Math.sin((cycle / 0.35) * (Math.PI / 2)) * 0.6
      : cycle < 0.6
      ? Math.sin(((cycle - 0.35) / 0.25) * Math.PI) * 1.4
      : Math.cos(((cycle - 0.6) / 0.4) * (Math.PI / 2)) * 0.3;

    pelvis_pivot.position.y = base_pelvis_y - 0.1;
    pelvis_pivot.rotation.y = -strike * 0.45;
    torso_pivot.rotation.y = -strike * 0.55;
    torso_pivot.rotation.x = Math.max(0, strike) * 0.28;
    head_pivot.rotation.y = strike * 0.4;

    right_shoulder.rotation.x = -1.35 - strike * 0.65;
    right_shoulder.rotation.z = -0.25;
    right_elbow.rotation.x = strike > 0.2 ? -0.15 : -1.1;

    left_shoulder.rotation.x = -0.65 + strike * 0.35;
    left_shoulder.rotation.z = 0.35;
    left_elbow.rotation.x = -1.05;

    left_hip.rotation.x = -0.45;
    left_knee.rotation.x = 0.65;
    right_hip.rotation.x = 0.38;
    right_knee.rotation.x = 0.35;
  } else if (anim_id === 'crouch') {
    const breath = Math.sin(elapsed_time * 2.8);
    pelvis_pivot.position.y = base_pelvis_y - 0.34 + breath * 0.025;
    torso_pivot.rotation.x = 0.42 + breath * 0.03;
    head_pivot.rotation.x = -0.32;
    head_pivot.rotation.y = Math.sin(elapsed_time * 1.3) * 0.28;

    left_hip.rotation.x = -1.05;
    left_knee.rotation.x = 1.65;
    right_hip.rotation.x = -0.85;
    right_knee.rotation.x = 1.45;

    left_shoulder.rotation.x = -0.45;
    left_shoulder.rotation.z = 0.25;
    left_elbow.rotation.x = -0.95;

    right_shoulder.rotation.x = -0.45;
    right_shoulder.rotation.z = -0.25;
    right_elbow.rotation.x = -0.95;
    shadow_scale = 1.12;
  } else if (anim_id === 'salute') {
    const breath = Math.sin(elapsed_time * 2.2);
    pelvis_pivot.position.y = base_pelvis_y + breath * 0.015;
    torso_pivot.rotation.x = -0.05;
    head_pivot.rotation.x = -0.04;

    right_shoulder.rotation.x = -2.15;
    right_shoulder.rotation.z = -0.55;
    right_elbow.rotation.x = -1.85;
    right_elbow.rotation.z = 0.35;

    left_shoulder.rotation.z = 0.06;
    left_elbow.rotation.x = -0.12;
  } else {
    const breath = Math.sin(elapsed_time * 2.4);
    const look = Math.sin(elapsed_time * 1.1);
    pelvis_pivot.position.y = base_pelvis_y + breath * 0.025;
    torso_pivot.rotation.x = breath * 0.03;
    head_pivot.rotation.y = look * 0.18;
    head_pivot.rotation.x = Math.cos(elapsed_time * 1.5) * 0.05;

    left_shoulder.rotation.z = 0.08 + breath * 0.03;
    left_shoulder.rotation.x = breath * 0.04;
    left_elbow.rotation.x = -0.22;

    right_shoulder.rotation.z = -0.08 - breath * 0.03;
    right_shoulder.rotation.x = -breath * 0.04;
    right_elbow.rotation.x = -0.22;
  }

  if (contact_shadow_mesh) {
    contact_shadow_mesh.scale.set(shadow_scale, shadow_scale, 1);
  }
}

/**
 * Builds the architectural pavilion model when specifically viewing the pavilion preset
 */
function build_procedural_pavilion_model() {
  const group = new THREE.Group();

  const plinth_geo = new THREE.BoxGeometry(4.2, 0.22, 4.2);
  const plinth_mat = new THREE.MeshStandardMaterial({
    color: 0xd7c4b7,
    roughness: 0.85,
    metalness: 0.05,
  });
  const plinth = new THREE.Mesh(plinth_geo, plinth_mat);
  plinth.position.y = 0.11;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const step_geo = new THREE.BoxGeometry(3.4, 0.16, 3.4);
  const step_mat = new THREE.MeshStandardMaterial({
    color: 0xecdcd0,
    roughness: 0.8,
  });
  const step = new THREE.Mesh(step_geo, step_mat);
  step.position.y = 0.3;
  step.castShadow = true;
  step.receiveShadow = true;
  group.add(step);

  const core_geo = new THREE.BoxGeometry(0.35, 1.9, 2.4);
  const core_mat = new THREE.MeshStandardMaterial({
    color: 0x7d6b5d,
    roughness: 0.7,
    metalness: 0.1,
  });
  const core = new THREE.Mesh(core_geo, core_mat);
  core.position.set(-0.75, 1.33, 0);
  core.castShadow = true;
  core.receiveShadow = true;
  group.add(core);

  const screen_geo = new THREE.BoxGeometry(1.6, 1.4, 0.12);
  const screen_mat = new THREE.MeshStandardMaterial({
    color: 0xc28460,
    roughness: 0.6,
  });
  const screen = new THREE.Mesh(screen_geo, screen_mat);
  screen.position.set(0.4, 1.08, -0.9);
  screen.castShadow = true;
  screen.receiveShadow = true;
  group.add(screen);

  const col_geo = new THREE.CylinderGeometry(0.045, 0.045, 1.9, 24);
  const col_mat = new THREE.MeshStandardMaterial({
    color: 0xc28460,
    metalness: 0.85,
    roughness: 0.28,
  });

  const column_coords = [
    [1.1, 1.33, 1.3],
    [1.1, 1.33, -1.3],
    [-1.2, 1.33, 1.3],
    [-1.2, 1.33, -1.3],
    [0.3, 1.33, 1.3],
    [-0.4, 1.33, 1.3],
  ];

  column_coords.forEach(([cx, cy, cz]) => {
    const col = new THREE.Mesh(col_geo, col_mat);
    col.position.set(cx, cy, cz);
    col.castShadow = true;
    group.add(col);
  });

  const roof_main_geo = new THREE.BoxGeometry(3.9, 0.24, 3.9);
  const roof_mat = new THREE.MeshStandardMaterial({
    color: 0xf4ece4,
    roughness: 0.75,
  });
  const roof = new THREE.Mesh(roof_main_geo, roof_mat);
  roof.position.y = 2.4;
  roof.castShadow = true;
  group.add(roof);

  return group;
}

export default function LUMEN_3d_canvas_preview({
  fileUrl,
  fileData,
  fileExtension = 'glb',
  fileName = '3D_Character_Showcase.glb',
  mode = 'card', // 'card' | 'modal'
  is_seamless = false,
  initialAnimation = 'walk',
  initialSkin = 'cyber',
  customAnimations = [],
  onAnimationChange,
  onSkinChange,
  onCustomAnimationsChange,
  onUploadFile,
  onOpenModal,
}) {
  const container_ref = useRef(null);
  const file_input_ref = useRef(null);
  const anim_input_ref = useRef(null);
  const scene_ref = useRef(null);
  const turntable_group_ref = useRef(null);
  const camera_ref = useRef(null);
  const renderer_ref = useRef(null);
  const controls_ref = useRef(null);
  const current_model_ref = useRef(null);
  const contact_shadow_ref = useRef(null);
  const grid_ref = useRef(null);
  const mixer_ref = useRef(null);
  const clip_actions_ref = useRef({});
  const active_action_ref = useRef(null);
  const anim_frame_ref = useRef(null);
  const companion_files_map_ref = useRef(new Map());
  const [companion_version, set_companion_version] = useState(0);

  const [is_loading, set_is_loading] = useState(true);
  const [active_anim, set_active_anim] = useState(initialAnimation || 'walk');
  const [is_playing, set_is_playing] = useState(true);
  const [playback_speed, set_playback_speed] = useState(1);
  const [character_skin, set_character_skin] = useState(initialSkin || 'cyber');
  const [embedded_clips, set_embedded_clips] = useState([]);
  const [uploaded_anim_clips, set_uploaded_anim_clips] = useState([]);
  const [auto_rotate, set_auto_rotate] = useState(false);
  const [is_wireframe, set_is_wireframe] = useState(false);
  const [shading_mode, set_shading_mode] = useState('solid'); // 'solid' | 'wireframe' | 'clay' | 'normals'
  const [show_grid, set_show_grid] = useState(true);
  const [is_dock_collapsed, set_is_dock_collapsed] = useState(false);
  const [model_stats, set_model_stats] = useState({ vertices: 0, faces: 0, size_str: '' });

  // Mutable refs for animation loop access without re-creating WebGL context
  const active_anim_ref = useRef(active_anim);
  active_anim_ref.current = active_anim;
  const is_playing_ref = useRef(is_playing);
  is_playing_ref.current = is_playing;
  const playback_speed_ref = useRef(playback_speed);
  playback_speed_ref.current = playback_speed;
  const auto_rotate_ref = useRef(auto_rotate);
  auto_rotate_ref.current = auto_rotate;
  const custom_animations_prop_ref = useRef(customAnimations);
  custom_animations_prop_ref.current = customAnimations;

  const ext_clean = (fileExtension || fileName.split('.').pop() || 'glb').toLowerCase().replace('.', '');
  const is_modal_mode = mode === 'modal';
  const is_pavilion_seed = Boolean(
    (fileUrl && fileUrl.includes('file_seed_model_pavilion')) ||
    (fileName && fileName.toLowerCase().includes('pavilion'))
  );
  const has_custom_model_source = Boolean(
    (fileUrl && !fileUrl.includes('file_seed_model_pavilion') && !fileUrl.includes('file_seed_character')) ||
    fileData
  );

  // Registers an array of THREE.AnimationClip instances onto the current character's AnimationMixer
  const register_custom_three_clips = (three_clips, fallback_label = 'Custom Anim', persist_to_card = false) => {
    const model_obj = current_model_ref.current;
    if (!model_obj || !Array.isArray(three_clips) || three_clips.length === 0) return;

    if (!mixer_ref.current) {
      mixer_ref.current = new THREE.AnimationMixer(model_obj);
    }
    const mixer = mixer_ref.current;
    const next_actions = { ...clip_actions_ref.current };
    const newly_added_items = [];
    const serialized_list = [];

    three_clips.forEach((raw_clip, idx) => {
      if (!raw_clip) return;
      const clean_title =
        raw_clip.name && !['mixamo.com', 'Take 001', 'Armature|mixamo.com|Layer0'].includes(raw_clip.name)
          ? raw_clip.name
          : three_clips.length > 1
          ? `${fallback_label} ${idx + 1}`
          : fallback_label;

      const retargeted = retarget_clip_to_model(raw_clip, model_obj);
      retargeted.name = clean_title;

      const clip_id = `custom_${clean_title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${idx}`;
      next_actions[clip_id] = mixer.clipAction(retargeted);
      newly_added_items.push({ id: clip_id, label: clean_title, is_custom: true });

      try {
        serialized_list.push({
          id: clip_id,
          label: clean_title,
          clip_json: THREE.AnimationClip.toJSON(retargeted),
        });
      } catch (_) {}
    });

    clip_actions_ref.current = next_actions;

    if (newly_added_items.length > 0) {
      set_uploaded_anim_clips((prev) => {
        const existing_ids = new Set(prev.map((p) => p.id));
        const filtered_new = newly_added_items.filter((item) => !existing_ids.has(item.id));
        return [...prev, ...filtered_new];
      });

      const first_id = newly_added_items[0].id;
      set_active_anim(first_id);
      set_is_playing(true);
      if (typeof onAnimationChange === 'function') {
        onAnimationChange(first_id);
      }

      if (persist_to_card && typeof onCustomAnimationsChange === 'function' && serialized_list.length > 0) {
        const existing_saved = Array.isArray(custom_animations_prop_ref.current)
          ? custom_animations_prop_ref.current
          : [];
        const merged = [...existing_saved, ...serialized_list].slice(-16);
        onCustomAnimationsChange(merged);
      }
    }
  };

  // Handle uploading custom animation files (.fbx, .glb, .gltf, .bvh, .json)
  const handle_animation_files_chosen = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const base_label = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');

      const reader = new FileReader();
      if (ext === 'json' || ext === 'bvh') {
        reader.onload = (ev) => {
          try {
            const text = String(ev.target?.result || '');
            if (ext === 'json') {
              const parsed = JSON.parse(text);
              const raw_clips = Array.isArray(parsed)
                ? parsed
                : parsed.animations
                ? parsed.animations
                : [parsed];
              const clips = raw_clips
                .filter((c) => c && Array.isArray(c.tracks))
                .map((c) => THREE.AnimationClip.parse(c));
              register_custom_three_clips(clips, base_label, true);
            } else if (ext === 'bvh') {
              const bvh_loader = new BVHLoader();
              const res = bvh_loader.parse(text);
              if (res && res.clip) {
                res.clip.name = base_label;
                register_custom_three_clips([res.clip], base_label, true);
              }
            }
          } catch (err) {
            console.warn('[3D Player] Custom animation parse notice:', err);
          }
        };
        reader.readAsText(file);
      } else {
        reader.onload = (ev) => {
          const buffer = ev.target?.result;
          if (!buffer) return;
          try {
            const safe_anim_manager = create_safe_3d_loading_manager('', companion_files_map_ref.current);
            if (ext === 'fbx') {
              const fbx_loader = new FBXLoader(safe_anim_manager);
              const fbx_obj = fbx_loader.parse(buffer, '');
              if (fbx_obj?.animations?.length > 0) {
                register_custom_three_clips(fbx_obj.animations, base_label, true);
              }
            } else if (ext === 'glb' || ext === 'gltf') {
              const gltf_loader = new GLTFLoader(safe_anim_manager);
              gltf_loader.parse(
                buffer,
                '',
                (gltf) => {
                  if (gltf?.animations?.length > 0) {
                    register_custom_three_clips(gltf.animations, base_label, true);
                  }
                },
                (err) => console.warn('[3D Player] GLTF animation parse notice:', err)
              );
            }
          } catch (err) {
            console.warn('[3D Player] Binary animation parse notice:', err);
          }
        };
        reader.readAsArrayBuffer(file);
      }
    });

    e.target.value = '';
  };

  // 1. Initialize Scene, Camera, Renderer, Studio Environment, Touch/Wheel/Pinch 360° Controls & Animation Loop
  useEffect(() => {
    const container = container_ref.current;
    if (!container) return;

    const is_software_gl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch (_) {
        return false;
      }
    })();

    const width = container.clientWidth || 320;
    const height = container.clientHeight || (is_modal_mode ? 460 : 210);

    const scene = new THREE.Scene();
    scene_ref.current = scene;

    // 360-Degree Turntable Group that holds grid + model + contact shadow
    const turntable_group = new THREE.Group();
    turntable_group.name = 'lumen_360_turntable_group';
    scene.add(turntable_group);
    turntable_group_ref.current = turntable_group;

    const camera = new THREE.PerspectiveCamera(42, width / Math.max(1, height), 0.1, 1000);
    camera.position.set(2.8, 2.1, 3.8);
    camera_ref.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !is_software_gl,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(is_software_gl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.LinearToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = !is_software_gl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    try {
      const pmrem_gen = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem_gen.fromScene(new RoomEnvironment(), 0.04).texture;
      if ('environmentIntensity' in scene) {
        scene.environmentIntensity = 0.25;
      }
      pmrem_gen.dispose();
    } catch (_) {}

    renderer.domElement.className = styles['lumen-3d-canvas'];
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);
    renderer_ref.current = renderer;

    // OrbitControls for full 360-degree touch & mouse rotation + wheel & pinch zoom
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !is_software_gl;
    controls.dampingFactor = 0.08;
    controls.enableRotate = true;
    controls.rotateSpeed = 1.0;
    controls.enableZoom = true;
    controls.zoomSpeed = 1.2;
    controls.enablePan = true;
    controls.autoRotate = auto_rotate_ref.current;
    controls.autoRotateSpeed = 2.2;
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI - 0.05;
    controls.minDistance = 0.75;
    controls.maxDistance = 30;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_ROTATE,
    };
    controls_ref.current = controls;

    // Balanced True-Color Studio Lighting Rig (prevents washing out stylized/anime skin tones)
    const hemi_light = new THREE.HemisphereLight(0xffffff, 0x475569, 0.72);
    scene.add(hemi_light);

    const dir_light_key = new THREE.DirectionalLight(0xfffaf5, 0.95);
    dir_light_key.position.set(4.5, 7.5, 5.0);
    dir_light_key.castShadow = !is_software_gl;
    dir_light_key.shadow.mapSize.width = 1024;
    dir_light_key.shadow.mapSize.height = 1024;
    dir_light_key.shadow.bias = -0.0005;
    scene.add(dir_light_key);

    const dir_light_fill = new THREE.DirectionalLight(0xf8fafc, 0.32);
    dir_light_fill.position.set(-4.5, 3.5, -3.0);
    scene.add(dir_light_fill);

    const rim_light = new THREE.DirectionalLight(0xe2e8f0, 0.22);
    rim_light.position.set(0, 3.0, -5.0);
    scene.add(rim_light);

    // Ground Grid
    const grid_helper = new THREE.GridHelper(10, 20, 0x94a3b8, 0xe2e8f0);
    grid_helper.position.y = -0.01;
    turntable_group.add(grid_helper);
    grid_ref.current = grid_helper;

    // Ground Contact Shadow Plane
    const shadow_tex = create_contact_shadow_texture();
    const shadow_mat = new THREE.MeshBasicMaterial({
      map: shadow_tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    });
    const shadow_plane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), shadow_mat);
    shadow_plane.rotation.x = -Math.PI / 2;
    shadow_plane.position.y = 0.005;
    turntable_group.add(shadow_plane);
    contact_shadow_ref.current = shadow_plane;

    const dom = renderer.domElement;
    // IMPORTANT: Only stop propagation on initial down/wheel events so Card.jsx doesn't drag the card,
    // NEVER stop propagation on pointermove/pointerup because OrbitControls attaches pointermove/pointerup to ownerDocument!
    const stop_down_only = (e) => {
      e.stopPropagation();
    };

    const handle_wheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    dom.addEventListener('mousedown', stop_down_only);
    dom.addEventListener('pointerdown', stop_down_only);
    dom.addEventListener('touchstart', stop_down_only, { passive: false });
    dom.addEventListener('wheel', handle_wheel, { passive: false });

    const clock = new THREE.Clock();
    let elapsed_accum = 0;
    let running = true;

    const animate = () => {
      if (!running) return;
      anim_frame_ref.current = requestAnimationFrame(animate);

      const raw_delta = Math.min(clock.getDelta(), 0.1);
      const eff_delta = is_playing_ref.current ? raw_delta * playback_speed_ref.current : 0;
      elapsed_accum += eff_delta;

      const cur_anim = active_anim_ref.current;
      const has_native_clip = Boolean(
        mixer_ref.current &&
        clip_actions_ref.current &&
        clip_actions_ref.current[cur_anim]
      );

      if (has_native_clip) {
        mixer_ref.current.update(eff_delta);
      } else if (
        current_model_ref.current?.userData?.rig_joints &&
        cur_anim &&
        cur_anim !== 'none'
      ) {
        evaluate_procedural_animation(
          current_model_ref.current,
          cur_anim,
          elapsed_accum,
          contact_shadow_ref.current
        );
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h, false);
        }
      }
    });
    ro.observe(container);

    return () => {
      running = false;
      if (anim_frame_ref.current) cancelAnimationFrame(anim_frame_ref.current);
      ro.disconnect();
      dom.removeEventListener('mousedown', stop_down_only);
      dom.removeEventListener('pointerdown', stop_down_only);
      dom.removeEventListener('touchstart', stop_down_only);
      dom.removeEventListener('wheel', handle_wheel);
      controls.dispose();
      shadow_tex.dispose();
      shadow_mat.dispose();
      renderer.dispose();
      if (container.contains(dom)) container.removeChild(dom);
    };
  }, [is_modal_mode]);

  // Sync OrbitControls autoRotate
  useEffect(() => {
    if (controls_ref.current) {
      controls_ref.current.autoRotate = auto_rotate;
    }
  }, [auto_rotate]);

  // Sync Grid visibility
  useEffect(() => {
    if (grid_ref.current) {
      grid_ref.current.visible = show_grid;
    }
  }, [show_grid]);

  // Switch active AnimationAction when user picks an embedded or uploaded GLTF/FBX/BVH clip
  useEffect(() => {
    const actions = clip_actions_ref.current || {};
    const target_action = actions[active_anim];
    if (target_action && mixer_ref.current) {
      if (active_action_ref.current && active_action_ref.current !== target_action) {
        active_action_ref.current.fadeOut(0.2);
      }
      target_action.reset().fadeIn(0.2).play();
      active_action_ref.current = target_action;
    } else if (active_action_ref.current) {
      active_action_ref.current.fadeOut(0.2);
      active_action_ref.current = null;
    }
  }, [active_anim, embedded_clips, uploaded_anim_clips]);

  // 2. Load 3D Model or Build Articulated 3D Character Rig
  useEffect(() => {
    const scene = scene_ref.current;
    const turntable_group = turntable_group_ref.current || scene;
    if (!scene || !turntable_group) return;

    set_is_loading(true);

    const setup_loaded_model = (model_obj, animations_list = []) => {
      if (current_model_ref.current) {
        turntable_group.remove(current_model_ref.current);
      }
      if (mixer_ref.current) {
        mixer_ref.current.stopAllAction();
        mixer_ref.current = null;
      }
      clip_actions_ref.current = {};
      active_action_ref.current = null;

      current_model_ref.current = model_obj;
      turntable_group.add(model_obj);

      // 1. Measure raw model bounds before normalization
      model_obj.updateMatrixWorld(true);
      const raw_box = new THREE.Box3().setFromObject(model_obj);
      const raw_size = raw_box.getSize(new THREE.Vector3());
      const raw_max_dim = Math.max(raw_size.x, raw_size.y, raw_size.z, 0.001);

      // 2. Resize / Normalize model to fit neatly inside the studio scene (target ~1.85m height/span)
      const target_scene_size = is_pavilion_seed ? 2.6 : 1.85;
      if (model_obj.userData?.rig_joints) {
        const rig_scale = target_scene_size / raw_max_dim;
        model_obj.scale.setScalar(rig_scale);
      } else {
        const norm_scale = target_scene_size / raw_max_dim;
        model_obj.scale.multiplyScalar(norm_scale);
      }

      // 3. Recompute normalized bounds and center model on the studio floor (x=0, y=0, z=0)
      model_obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model_obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      if (!model_obj.userData?.rig_joints) {
        model_obj.position.x -= center.x;
        model_obj.position.y -= box.min.y;
        model_obj.position.z -= center.z;
        model_obj.userData.base_floor_y = model_obj.position.y;
      } else {
        model_obj.position.set(0, 0, 0);
      }

      // Scale contact shadow proportionally to model footprint
      if (contact_shadow_ref.current) {
        const footprint = Math.max(size.x, size.z, 0.9) * 1.15;
        contact_shadow_ref.current.scale.set(footprint, footprint, 1);
      }

      const mixer = new THREE.AnimationMixer(model_obj);
      mixer_ref.current = mixer;
      const action_map = {};

      if (Array.isArray(animations_list) && animations_list.length > 0) {
        const clip_items = animations_list.map((clip, idx) => {
          const raw_name = clip.name || `Clip_${idx + 1}`;
          const id = `clip_${idx}_${raw_name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
          action_map[id] = mixer.clipAction(clip);
          return { id, label: raw_name };
        });

        set_embedded_clips(clip_items);
      } else {
        set_embedded_clips([]);
      }

      // Restore any persisted custom animations from card state
      const saved_custom = Array.isArray(custom_animations_prop_ref.current)
        ? custom_animations_prop_ref.current
        : [];
      const restored_custom_items = [];
      saved_custom.forEach((entry) => {
        if (entry && entry.clip_json) {
          try {
            const parsed_clip = THREE.AnimationClip.parse(entry.clip_json);
            const retargeted = retarget_clip_to_model(parsed_clip, model_obj);
            const cid = entry.id || `custom_${entry.label || 'anim'}`;
            action_map[cid] = mixer.clipAction(retargeted);
            restored_custom_items.push({
              id: cid,
              label: entry.label || parsed_clip.name || 'Custom Anim',
              is_custom: true,
            });
          } catch (_) {}
        }
      });
      set_uploaded_anim_clips(restored_custom_items);

      clip_actions_ref.current = action_map;

      // For custom uploaded 3D models, do NOT auto-play initial animations on load
      if (!model_obj.userData?.rig_joints) {
        if (active_anim_ref.current && action_map[active_anim_ref.current]) {
          action_map[active_anim_ref.current].reset().play();
          active_action_ref.current = action_map[active_anim_ref.current];
        } else {
          set_active_anim('none');
          active_anim_ref.current = 'none';
          active_action_ref.current = null;
        }
      } else if (action_map[active_anim_ref.current]) {
        action_map[active_anim_ref.current].reset().play();
        active_action_ref.current = action_map[active_anim_ref.current];
      }

      // 4. Frustum-Aware Camera Framing so the entire 3D object fits inside the viewport with margin
      const max_dim = Math.max(size.x, size.y, size.z, 1.2);
      const target_y = Math.max(size.y * 0.48, 0.75);

      if (camera_ref.current && controls_ref.current) {
        const cam = camera_ref.current;
        const fov_rad = THREE.MathUtils.degToRad(cam.fov || 42);
        const aspect = Math.max(cam.aspect || 1.2, 0.5);
        const fit_height_dist = (max_dim * 0.68) / Math.tan(fov_rad * 0.5);
        const fit_width_dist = (max_dim * 0.68) / (Math.tan(fov_rad * 0.5) * aspect);
        const cam_dist = Math.max(fit_height_dist, fit_width_dist, 2.8) * 1.28;

        cam.userData.fitted_dist = cam_dist;
        cam.userData.fitted_target_y = target_y;

        cam.position.set(cam_dist * 0.68, target_y + cam_dist * 0.32, cam_dist * 0.92);
        cam.lookAt(0, target_y, 0);
        controls_ref.current.target.set(0, target_y, 0);
        controls_ref.current.minDistance = Math.max(0.5, max_dim * 0.35);
        controls_ref.current.maxDistance = Math.max(25, cam_dist * 4);
        controls_ref.current.update();
      }

      let total_vertices = 0;
      let total_triangles = 0;
      model_obj.traverse((child) => {
        if (child.isMesh && child.geometry) {
          child.castShadow = true;
          child.receiveShadow = true;

          // Normalize custom model materials so diffuse/anime textures render with true sRGB saturation
          if (!model_obj.userData?.rig_joints && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat) => {
              if (!mat) return;
              if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
                mat.map.needsUpdate = true;
              }
              if (mat.emissiveMap) {
                mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
                mat.emissiveMap.needsUpdate = true;
              }
              if ('envMapIntensity' in mat) {
                mat.envMapIntensity = 0.2;
              }
              if (mat.map && !mat.metalnessMap && typeof mat.metalness === 'number') {
                mat.metalness = Math.min(mat.metalness, 0.05);
              }
              if (mat.map && !mat.roughnessMap && typeof mat.roughness === 'number') {
                mat.roughness = Math.max(mat.roughness, 0.78);
              }
              mat.needsUpdate = true;
            });
          }

          const geo = child.geometry;
          if (geo.attributes.position) {
            total_vertices += geo.attributes.position.count;
          }
          if (geo.index) {
            total_triangles += geo.index.count / 3;
          } else if (geo.attributes.position) {
            total_triangles += geo.attributes.position.count / 3;
          }
        }
      });

      set_model_stats({
        vertices: Math.round(total_vertices),
        faces: Math.round(total_triangles),
        size_str: `${raw_size.x.toFixed(1)}m × ${raw_size.y.toFixed(1)}m × ${raw_size.z.toFixed(1)}m`,
      });

      set_is_loading(false);
    };

    if (is_pavilion_seed) {
      setup_loaded_model(build_procedural_pavilion_model(), []);
      return;
    }

    if (!has_custom_model_source) {
      setup_loaded_model(build_articulated_character_rig(character_skin), []);
      return;
    }

    const load_source = fileUrl || fileData;
    const is_obj = ext_clean === 'obj';
    const is_stl = ext_clean === 'stl';
    const is_fbx = ext_clean === 'fbx';
    const is_gltf = ['gltf', 'glb'].includes(ext_clean);

    const safe_manager = create_safe_3d_loading_manager(load_source, companion_files_map_ref.current);

    try {
      if (is_gltf) {
        const gltf_loader = new GLTFLoader(safe_manager);
        if (typeof load_source === 'string' && load_source.startsWith('data:')) {
          const bin_str = atob(load_source.split(',')[1] || '');
          const len = bin_str.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = bin_str.charCodeAt(i);
          gltf_loader.parse(
            bytes.buffer,
            '',
            (gltf) => setup_loaded_model(gltf.scene || gltf.scenes[0], gltf.animations || []),
            () => setup_loaded_model(build_articulated_character_rig(character_skin), [])
          );
        } else {
          gltf_loader.load(
            load_source,
            (gltf) => setup_loaded_model(gltf.scene || gltf.scenes[0], gltf.animations || []),
            undefined,
            () => setup_loaded_model(build_articulated_character_rig(character_skin), [])
          );
        }
      } else if (is_fbx) {
        const fbx_loader = new FBXLoader(safe_manager);
        if (typeof load_source === 'string' && load_source.startsWith('data:')) {
          const bin_str = atob(load_source.split(',')[1] || '');
          const len = bin_str.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = bin_str.charCodeAt(i);
          const fbx_obj = fbx_loader.parse(bytes.buffer, '');
          setup_loaded_model(fbx_obj, fbx_obj.animations || []);
        } else {
          fbx_loader.load(
            load_source,
            (fbx_obj) => setup_loaded_model(fbx_obj, fbx_obj.animations || []),
            undefined,
            () => setup_loaded_model(build_articulated_character_rig(character_skin), [])
          );
        }
      } else if (is_obj) {
        const obj_loader = new OBJLoader(safe_manager);
        if (typeof load_source === 'string' && load_source.startsWith('data:')) {
          const raw = atob(load_source.split(',')[1] || '');
          const obj = obj_loader.parse(raw);
          setup_loaded_model(obj, []);
        } else {
          obj_loader.load(
            load_source,
            (obj) => setup_loaded_model(obj, []),
            undefined,
            () => setup_loaded_model(build_articulated_character_rig(character_skin), [])
          );
        }
      } else if (is_stl) {
        const stl_loader = new STLLoader(safe_manager);
        if (typeof load_source === 'string' && load_source.startsWith('data:')) {
          const bin_str = atob(load_source.split(',')[1] || '');
          const len = bin_str.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = bin_str.charCodeAt(i);
          const geo = stl_loader.parse(bytes.buffer);
          const mat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.45, metalness: 0.3 });
          setup_loaded_model(new THREE.Mesh(geo, mat), []);
        } else {
          stl_loader.load(
            load_source,
            (geo) => {
              const mat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.45, metalness: 0.3 });
              setup_loaded_model(new THREE.Mesh(geo, mat), []);
            },
            undefined,
            () => setup_loaded_model(build_articulated_character_rig(character_skin), [])
          );
        }
      } else {
        setup_loaded_model(build_articulated_character_rig(character_skin), []);
      }
    } catch (_) {
      setup_loaded_model(build_articulated_character_rig(character_skin), []);
    }
  }, [fileUrl, fileData, ext_clean, character_skin, is_pavilion_seed, has_custom_model_source, companion_version]);

  // 3. Apply Shading & Wireframe Modes
  useEffect(() => {
    const model = current_model_ref.current;
    if (!model) return;

    model.traverse((child) => {
      if (child.isMesh) {
        if (!child.userData.original_mat) {
          child.userData.original_mat = child.material;
        }

        if (shading_mode === 'wireframe' || is_wireframe) {
          child.material = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            wireframe: true,
          });
        } else if (shading_mode === 'normals') {
          child.material = new THREE.MeshNormalMaterial({ wireframe: false });
        } else if (shading_mode === 'clay') {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.85,
            metalness: 0.05,
          });
        } else {
          child.material = child.userData.original_mat;
        }
      }
    });
  }, [shading_mode, is_wireframe]);

  const handle_select_animation = (anim_id) => {
    set_active_anim(anim_id);
    set_is_playing(true);
    if (typeof onAnimationChange === 'function') {
      onAnimationChange(anim_id);
    }
  };

  const handle_select_skin = (skin_id) => {
    set_character_skin(skin_id);
    if (typeof onSkinChange === 'function') {
      onSkinChange(skin_id);
    }
  };

  const handle_cycle_speed = (e) => {
    e.stopPropagation();
    const cur_idx = SPEED_OPTIONS.indexOf(playback_speed);
    const next_speed = SPEED_OPTIONS[(cur_idx + 1) % SPEED_OPTIONS.length];
    set_playback_speed(next_speed);
  };

  const set_camera_view = (type) => {
    if (!camera_ref.current || !controls_ref.current) return;
    const cam = camera_ref.current;
    const ctrl = controls_ref.current;
    const dist = cam.userData?.fitted_dist || 3.6;
    const target_y = cam.userData?.fitted_target_y || 0.85;

    switch (type) {
      case 'front':
        cam.position.set(0, target_y + dist * 0.12, dist);
        break;
      case 'side':
        cam.position.set(dist, target_y + dist * 0.12, 0);
        break;
      case 'back':
        cam.position.set(0, target_y + dist * 0.12, -dist);
        break;
      case 'isometric':
        cam.position.set(dist * 0.72, target_y + dist * 0.45, dist * 0.72);
        break;
      default:
        cam.position.set(dist * 0.68, target_y + dist * 0.32, dist * 0.92);
        break;
    }
    cam.lookAt(0, target_y, 0);
    ctrl.target.set(0, target_y, 0);
    ctrl.update();
  };

  const handle_file_chosen = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    let main_model_file = null;
    let added_companions = false;

    files.forEach((f) => {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (['glb', 'gltf', 'fbx', 'obj', 'stl'].includes(ext) && !main_model_file) {
        main_model_file = f;
      } else {
        const key = f.name.toLowerCase();
        companion_files_map_ref.current.set(key, URL.createObjectURL(f));
        added_companions = true;
      }
    });

    if (main_model_file && typeof onUploadFile === 'function') {
      onUploadFile(main_model_file);
    } else if (added_companions) {
      set_companion_version((v) => v + 1);
    }

    e.target.value = '';
  };

  const available_animations = has_custom_model_source
    ? [...uploaded_anim_clips, ...embedded_clips]
    : [...uploaded_anim_clips, ...embedded_clips, ...BUILTIN_ANIMATIONS];

  return (
    <div
      className={`${styles['lumen-3d-player-layout']} ${
        is_modal_mode ? styles['lumen-3d-player-layout-modal'] : ''
      }`}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Hidden 3D Character Mesh & Companion Textures File Input */}
      {onUploadFile && (
        <input
          ref={file_input_ref}
          type="file"
          multiple
          accept=".glb,.gltf,.fbx,.obj,.stl,.bin,.jpg,.jpeg,.png,.webp"
          style={{ display: 'none' }}
          onChange={handle_file_chosen}
        />
      )}

      {/* Hidden Custom Animation Clip File Input */}
      <input
        ref={anim_input_ref}
        type="file"
        multiple
        accept=".fbx,.glb,.gltf,.bvh,.json"
        style={{ display: 'none' }}
        onChange={handle_animation_files_chosen}
      />

      {/* ====================================================================
          TOP SECTION: DEDICATED 3D SCENE VIEWPORT
          (Touch/Drag to Rotate 360°, Scroll Wheel & Pinch to Zoom In/Out)
          ==================================================================== */}
      <div
        className={`${styles['lumen-3d-container']} ${
          is_modal_mode ? styles['lumen-3d-container-modal'] : ''
        }`}
      >
        {/* Dedicated WebGL Mount Container */}
        <div ref={container_ref} className={styles['lumen-3d-canvas-mount']} />

        {/* Top-Left Format & Character Badge */}
        {!is_modal_mode && (
          <div className={styles['lumen-3d-format-pill']}>
            <Box size={11} />
            <span>{has_custom_model_source ? `${ext_clean.toUpperCase()} 3D` : '3D CHARACTER RIG'}</span>
          </div>
        )}

        {/* Modal Top Stats Banner */}
        {is_modal_mode && (
          <div className={styles['lumen-3d-stats-banner']}>
            <div className={styles['lumen-3d-stat-item']}>
              <span>Model:</span>
              <span className={styles['lumen-3d-stat-value']}>
                {has_custom_model_source ? fileName : 'Cyber Explorer Rig'}
              </span>
            </div>
            {model_stats.faces > 0 && (
              <div className={styles['lumen-3d-stat-item']}>
                <span>Polygons:</span>
                <span className={styles['lumen-3d-stat-value']}>
                  {model_stats.faces.toLocaleString()}
                </span>
              </div>
            )}
            {model_stats.vertices > 0 && (
              <div className={styles['lumen-3d-stat-item']}>
                <span>Vertices:</span>
                <span className={styles['lumen-3d-stat-value']}>
                  {model_stats.vertices.toLocaleString()}
                </span>
              </div>
            )}
            {model_stats.size_str && (
              <div className={styles['lumen-3d-stat-item']}>
                <span>Bounds:</span>
                <span className={styles['lumen-3d-stat-value']}>{model_stats.size_str}</span>
              </div>
            )}
          </div>
        )}

        {/* Loading Overlay */}
        {is_loading && (
          <div className={styles['lumen-3d-loading-overlay']}>
            <Sparkles size={20} className={styles['lumen-3d-spinner']} color="#38bdf8" />
            <span>Loading 3D character studio...</span>
          </div>
        )}

        {/* Top-Right Scene Tools (Card Mode) */}
        {!is_modal_mode && (
          <div className={styles['lumen-3d-toolbar-card']}>
            {!has_custom_model_source && !is_pavilion_seed && (
              <div className={styles['lumen-3d-skin-dots']}>
                {CHARACTER_SKINS.map((sk) => (
                  <button
                    key={sk.id}
                    type="button"
                    className={`${styles['lumen-3d-skin-dot']} ${
                      character_skin === sk.id ? styles['lumen-3d-skin-dot-active'] : ''
                    }`}
                    style={{ backgroundColor: `#${sk.primary.toString(16).padStart(6, '0')}` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handle_select_skin(sk.id);
                    }}
                    title={`Character Theme: ${sk.label}`}
                  />
                ))}
              </div>
            )}

            <button
              type="button"
              className={`${styles['lumen-3d-tool-btn']} ${
                auto_rotate ? styles['lumen-3d-tool-btn-active'] : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                set_auto_rotate(!auto_rotate);
              }}
              title="Toggle 360° Auto-Rotate Turntable"
            >
              <RefreshCw size={12} />
            </button>

            <button
              type="button"
              className={`${styles['lumen-3d-tool-btn']} ${
                is_wireframe ? styles['lumen-3d-tool-btn-active'] : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                set_is_wireframe(!is_wireframe);
              }}
              title="Toggle Mesh Wireframe"
            >
              <Grid size={12} />
            </button>

            <button
              type="button"
              className={styles['lumen-3d-tool-btn']}
              onClick={(e) => {
                e.stopPropagation();
                set_camera_view('reset');
              }}
              title="Reset Camera & Zoom"
            >
              <RotateCcw size={12} />
            </button>

            {onUploadFile && (
              <button
                type="button"
                className={styles['lumen-3d-tool-btn']}
                onClick={(e) => {
                  e.stopPropagation();
                  file_input_ref.current?.click();
                }}
                title="Upload Custom 3D Character Mesh (.GLB, .GLTF, .FBX, .OBJ)"
              >
                <Upload size={12} />
              </button>
            )}

            {onOpenModal && (
              <button
                type="button"
                className={styles['lumen-3d-tool-btn']}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenModal();
                }}
                title="Expand to Full 3D Character Studio"
              >
                <Maximize2 size={12} />
              </button>
            )}
          </div>
        )}

        {/* Modal Scene Shading & Camera Controls Toolbar (Top-Right in Modal) */}
        {is_modal_mode && (
          <div
            className={styles['lumen-3d-modal-scene-toolbar']}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={`${styles['lumen-3d-modal-btn']} ${
                shading_mode === 'solid' ? styles['lumen-3d-modal-btn-active'] : ''
              }`}
              onClick={() => set_shading_mode('solid')}
            >
              <Layers size={13} />
              <span>Solid PBR</span>
            </button>

            <button
              type="button"
              className={`${styles['lumen-3d-modal-btn']} ${
                shading_mode === 'wireframe' ? styles['lumen-3d-modal-btn-active'] : ''
              }`}
              onClick={() => set_shading_mode('wireframe')}
            >
              <Grid size={13} />
              <span>Wireframe</span>
            </button>

            <button
              type="button"
              className={`${styles['lumen-3d-modal-btn']} ${
                shading_mode === 'clay' ? styles['lumen-3d-modal-btn-active'] : ''
              }`}
              onClick={() => set_shading_mode('clay')}
            >
              <Box size={13} />
              <span>Clay</span>
            </button>

            <button
              type="button"
              className={`${styles['lumen-3d-modal-btn']} ${
                shading_mode === 'normals' ? styles['lumen-3d-modal-btn-active'] : ''
              }`}
              onClick={() => set_shading_mode('normals')}
            >
              <Eye size={13} />
              <span>Normals</span>
            </button>

            <div className={styles['lumen-3d-divider-v']} />

            <button
              type="button"
              className={`${styles['lumen-3d-modal-btn']} ${
                auto_rotate ? styles['lumen-3d-modal-btn-active'] : ''
              }`}
              onClick={() => set_auto_rotate(!auto_rotate)}
            >
              <RefreshCw size={13} />
              <span>Auto-Spin</span>
            </button>

            <button
              type="button"
              className={`${styles['lumen-3d-modal-btn']} ${
                show_grid ? styles['lumen-3d-modal-btn-active'] : ''
              }`}
              onClick={() => set_show_grid(!show_grid)}
            >
              <Grid size={13} />
              <span>Grid</span>
            </button>

            <button
              type="button"
              className={styles['lumen-3d-modal-btn']}
              onClick={() => set_camera_view('front')}
            >
              <Camera size={13} />
              <span>Front</span>
            </button>

            <button
              type="button"
              className={styles['lumen-3d-modal-btn']}
              onClick={() => set_camera_view('side')}
            >
              <Camera size={13} />
              <span>Side</span>
            </button>

            <button
              type="button"
              className={styles['lumen-3d-modal-btn']}
              onClick={() => set_camera_view('back')}
            >
              <Camera size={13} />
              <span>Back</span>
            </button>

            <button
              type="button"
              className={styles['lumen-3d-modal-btn']}
              onClick={() => set_camera_view('reset')}
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* ====================================================================
          BOTTOM SECTION: SEPARATED ANIMATION DECK
          (Outside the 3D viewport so it can allocate many animations cleanly)
          ==================================================================== */}
      {!is_pavilion_seed && (
        <div
          className={`${styles['lumen-3d-anim-deck']} ${
            is_modal_mode ? styles['lumen-3d-anim-deck-modal'] : ''
          }`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Animation Deck Header Row */}
          <div className={styles['lumen-3d-anim-deck-header']}>
            <div className={styles['lumen-3d-anim-deck-title']}>
              <button
                type="button"
                className={styles['lumen-3d-anim-play-btn']}
                onClick={() => set_is_playing(!is_playing)}
                title={is_playing ? 'Pause Animation' : 'Play Animation'}
              >
                {is_playing ? <Pause size={11} /> : <Play size={11} />}
              </button>
              <User size={12} color="#38bdf8" />
              <span>Animations ({available_animations.length})</span>
            </div>

            <div className={styles['lumen-3d-anim-deck-actions']}>
              {is_modal_mode && !has_custom_model_source && (
                <div className={styles['lumen-3d-skin-dots']}>
                  {CHARACTER_SKINS.map((sk) => (
                    <button
                      key={sk.id}
                      type="button"
                      className={`${styles['lumen-3d-skin-dot']} ${
                        character_skin === sk.id ? styles['lumen-3d-skin-dot-active'] : ''
                      }`}
                      style={{ backgroundColor: `#${sk.primary.toString(16).padStart(6, '0')}` }}
                      onClick={() => handle_select_skin(sk.id)}
                      title={`Theme: ${sk.label}`}
                    />
                  ))}
                </div>
              )}

              <button
                type="button"
                className={styles['lumen-3d-speed-badge']}
                onClick={handle_cycle_speed}
                title="Click to cycle animation speed (0.5x, 1x, 1.5x, 2x)"
              >
                <Gauge size={10} />
                <span>{playback_speed}x</span>
              </button>

              <button
                type="button"
                className={styles['lumen-3d-add-anim-btn']}
                onClick={() => anim_input_ref.current?.click()}
                title="Upload Custom Animation Clip (.FBX, .GLB, .GLTF, .BVH, .JSON)"
              >
                <Plus size={11} />
                <span>Upload Anim</span>
              </button>

              {is_modal_mode && (
                <button
                  type="button"
                  className={styles['lumen-3d-speed-badge']}
                  onClick={() => set_is_dock_collapsed(!is_dock_collapsed)}
                  title={is_dock_collapsed ? 'Expand Animation Grid' : 'Collapse Animation Grid'}
                >
                  {is_dock_collapsed ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
              )}
            </div>
          </div>

          {/* Multi-Row Wrapping Animation Grid */}
          {!is_dock_collapsed && (
            <div className={styles['lumen-3d-anim-grid']}>
              {available_animations.length === 0 ? (
                <span className={styles['lumen-3d-anim-empty-hint']}>
                  Static pose · Click &ldquo;+ Upload Anim&rdquo; to add animations
                </span>
              ) : (
                available_animations.map((anim) => (
                  <button
                    key={anim.id}
                    type="button"
                    className={`${styles['lumen-3d-anim-pill']} ${
                      active_anim === anim.id ? styles['lumen-3d-anim-pill-active'] : ''
                    } ${anim.is_custom ? styles['lumen-3d-anim-pill-custom'] : ''}`}
                    onClick={() =>
                      handle_select_animation(active_anim === anim.id && has_custom_model_source ? 'none' : anim.id)
                    }
                    title={`Play animation: ${anim.label}`}
                  >
                    {anim.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
