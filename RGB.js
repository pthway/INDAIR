// ==UserScript==
// @name         NuPhy Air75 V3 – Custom RGB
// @namespace    local.nuphy.iso-custom
// @version      1.0.0
// @description  Enable Custom RGB on Air75 V3 ISO and save and restore colors locally.
// @match        https://drive.nuphy.io/*
// @run-at       document-start
// @sandbox      raw
// @grant        none
// @noframes
// ==/UserScript==
(() => {
  'use strict';
  if (window.nuphyIsoCustom) return;
  const STORAGE = 'nuphy-air75-v3-iso-custom-v1';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let stopped = false, timer, req, context, iso, originalSupport, supportWrapper;
  const patched = new Map();
  const completed = new WeakSet();
  let storageWarning = false;
  function warnStorage(error) {
    if (!storageWarning) console.warn('[NuPhy ISO] Colors could not be saved locally:', error);
    storageWarning = true;
  }
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE) || '{}');
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch (error) { warnStorage(error); return {}; }
  }
  function rgb(color) {
    if (typeof color === 'string') {
      if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
      const m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(color);
      if (m && m.slice(1).every(x => +x <= 255)) {
        return '#' + m.slice(1).map(x => (+x).toString(16).padStart(2, '0')).join('');
      }
    } else if (color && ['R', 'G', 'B'].every(k => Number.isInteger(color[k]) && color[k] >= 0 && color[k] <= 255)) {
      return '#' + ['R', 'G', 'B'].map(k => color[k].toString(16).padStart(2, '0')).join('');
    }
    return null;
  }
  function validPosition(api, keyPos) {
    const map = api.lightMapping;
    const index = map?.ledIndexByKeyPosition?.[keyPos];
    return Number.isInteger(keyPos) && keyPos >= 0 && Number.isInteger(index) && index >= 0 && index < map.keyLight;
  }
  function save(api, profile, changes) {
    if (stopped || ![0, 1].includes(profile)) return;
    const data = load();
    const colors = { ...(data[profile]?.colors || {}) };
    for (const item of changes) {
      const color = rgb(item.color);
      if (validPosition(api, item.keyPos) && color) colors[item.keyPos] = color;
    }
    try {
      data[profile] = { colors };
      localStorage.setItem(STORAGE, JSON.stringify(data));
    } catch (error) { warnStorage(error); }
  }
  function savedColors(api, profile) {
    return Object.entries(load()[profile]?.colors || {}).flatMap(([pos, value]) => {
      const keyPos = Number(pos), color = rgb(value);
      return validPosition(api, keyPos) && color ? [{ keyPos, color }] : [];
    });
  }
  function enableMenu() {
    if (context) return true;
    const chunks = window.webpackChunkNuPhyIO;
    // Do not push before webpack has installed its runtime callback.
    if (!Array.isArray(chunks) || chunks.push === Array.prototype.push) return false;
    chunks.push([['iso-custom-userscript-' + Date.now()], {}, runtime => { req = runtime; }]);
    if (!req) return false;
    const candidate = req(85130).A;
    const type = req(15860).ui.Air75V3ISO;
    if (!candidate || type == null || typeof candidate.isSupportSignalCustomLightModeForType !== 'function') {
      throw Error('The web app structure has changed. This script needs to be updated.');
    }
    context = candidate; iso = type;
    originalSupport = context.isSupportSignalCustomLightModeForType;
    supportWrapper = function(type, version) {
      return type === iso || originalSupport.call(this, type, version);
    };
    context.isSupportSignalCustomLightModeForType = supportWrapper;
    return true;
  }
  function watchColors(api) {
    if (patched.has(api)) return;
    const original = api.setCustomLight;
    const wrapped = async function(profile, colors) {
      const copy = Array.isArray(colors) ? colors.map(x => ({ keyPos: x.keyPos, color: rgb(x.color) })) : [];
      const result = await original.apply(this, arguments);
      if (result?.success) save(api, profile, copy);
      return result;
    };
    patched.set(api, { original, wrapped });
    api.setCustomLight = wrapped;
  }
  async function initialize(api) {
    const base = await api.getBaseInfo();
    const profile = base?.data?.currentMode;
    if (!base?.success || ![0, 1].includes(profile)) return false;
    const state = await api.getLightStates(profile);
    if (!state?.success || !Array.isArray(state.data)) return false;
    if (stopped || window.keyboardApi !== api) return false;
    const main = state.data.find(x => x.lightType === 'main');
    if (!main) return false;
    let colors = savedColors(api, profile);
    // First installation: preserve the current custom colors before activating anything.
    if (!colors.length && main.mode === 21) {
      const current = await api.getKeysLight();
      if (current?.success && Array.isArray(current.data)) {
        save(api, profile, Array.from(current.data, (color, keyPos) => ({ keyPos, color })));
        colors = savedColors(api, profile);
      }
    }
    for (let i = 0; i < 2; i++) {
      if (stopped || window.keyboardApi !== api) return false;
      const result = await api.setLightState(profile, 'main', { mode: 21, brightness: 100, isRGB: true });
      if (!result?.success) throw Error('Could not enable Custom mode: ' + JSON.stringify(result));
      await sleep(150);
    }
    if (stopped || window.keyboardApi !== api) return false;
    const check = await api.getLightStates(profile);
    if (!check?.success || check.data?.find(x => x.lightType === 'main')?.mode !== 21) {
      throw Error('The keyboard did not confirm mode 21.');
    }
    if (colors.length) {
      const result = await patched.get(api).original.call(api, profile, colors);
      if (!result?.success) throw Error('Could not restore saved colors: ' + JSON.stringify(result));
    }
    console.info(`[NuPhy ISO] Custom enabled for profile ${profile}. Sent ${colors.length} saved colors. New color selections will be saved locally.`);
    return true;
  }
  async function tick() {
    if (stopped) return;
    try {
      if (enableMenu()) {
        const api = window.keyboardApi;
        if (api && api.keyboardType === iso && typeof api.setCustomLight === 'function' && api.lightMapping && !completed.has(api)) {
          watchColors(api);
          // Let the app finish its connection handshake before requesting lighting state.
          await sleep(1500);
          if (!stopped && window.keyboardApi === api && await initialize(api)) completed.add(api);
        }
      }
    } catch (error) {
      console.warn('[NuPhy ISO] Automatic setup stopped:', error);
      window.nuphyIsoCustom.stop();
      return;
    }
    if (!stopped) timer = setTimeout(tick, 1000);
  }
  window.nuphyIsoCustom = {
    stop() {
      stopped = true;
      clearTimeout(timer);
      for (const [api, p] of patched) if (api.setCustomLight === p.wrapped) api.setCustomLight = p.original;
      if (context?.isSupportSignalCustomLightModeForType === supportWrapper) context.isSupportSignalCustomLightModeForType = originalSupport;
      console.info('[NuPhy ISO] Script stopped. Saved colors have been kept; the current keyboard lighting has not been changed.');
    }
  };
  tick();
})();
