// fallestateonboard SDK · sovereign single-file library · MIT · AI-Native Solutions
// Extracted from fallestateonboard/index.html · 80854 bytes of source logic
// Public-safe: no primes/glyphs/dyad references

/*!
 * Fall Kit · v1.0.0 · the shared cascade for every estate seed
 *
 * Inlineable JS module. Drop into any seed via <script> or copy-paste inline.
 * Preserves single-HTML sovereignty (no external deps until user opts in to T2 WebLLM).
 *
 * What it gives every seed:
 *  - AI tier picker: T0 (off · default) · T2 (WebLLM in-browser, 5 models 1B-70B) · T3 (BYOK Anthropic/OpenAI/Google)
 *  - Universal entry: FallKit.aiComplete(systemPrompt, userMsg, maxTokens) → string|null
 *  - AI chip UI in header
 *  - WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN)
 *  - Help section partial: FallKit.helpSection()
 *  - Settings panel: FallKit.openSettings()
 *
 * Doctrine (per botler CLAUDE.md):
 *  - T0 fallback ALWAYS works · aiComplete returns null · caller MUST degrade gracefully
 *  - NEVER hide a feature behind AI · NEVER proxy API keys · NEVER log keys
 *  - WebLLM is lazy-loaded · model weights download ONLY on user opt-in
 *
 * Estate-first canonical references:
 *  - WebLLM pattern: Downloads/botler/index.html (T0/T2/T3 cascade)
 *  - WebRTC pattern: Downloads/fallnet/fallnet-shim.js (raw RTCPeerConnection)
 *  - Mesh channel:   'fall-signal'
 */
(function (root) {
  'use strict';
  const FALL_KIT_VERSION = '1.2.0';
  const KCC_MINT_URL = 'https://sjgant80-hub.github.io/kcc-mint/';
  // ─── Model registry ──────────────────────────────────────────────
  const WEBLLM_MODELS = {
    'llama-1b':  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',   size: '~700MB', label: '1B · fast · any laptop / phone' },
    'llama-3b':  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',   size: '~2GB',   label: '3B · balanced · default · most laptops' },
    'qwen-7b':   { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',     size: '~5GB',   label: '7B · capable · needs decent GPU (M-series Mac / 8GB+ VRAM)' },
    'llama-8b':  { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC',   size: '~5GB',   label: '8B · common · needs decent GPU' },
    'llama-70b': { id: 'Llama-3.1-70B-Instruct-q4f16_1-MLC',  size: '~40GB',  label: '70B · frontier · needs serious GPU + 64GB+ RAM' },
  };
  const DEFAULT_MODEL = 'llama-3b';
  const T3_PROVIDERS = {
    anthropic: { label: 'Anthropic Claude', models: ['claude-sonnet-4-5','claude-opus-4-7','claude-haiku-4-5'], default: 'claude-sonnet-4-5', url: 'https://api.anthropic.com/v1/messages' },
    openai:    { label: 'OpenAI',           models: ['gpt-4o','gpt-4o-mini','o1-mini'],                          default: 'gpt-4o-mini',      url: 'https://api.openai.com/v1/chat/completions' },
    google:    { label: 'Google Gemini',    models: ['gemini-1.5-pro','gemini-1.5-flash','gemini-2.0-flash-exp'], default: 'gemini-1.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/' },
  };
  // ─── State ───────────────────────────────────────────────────────
  const STATE = {
    config: loadConfig(),
    ai: { ready: false, loading: false, progress: 0, engine: null, model: null },
    mesh: { active: false, peers: new Map(), bc: null, signal: null },
  };
  function loadConfig() {
    try { return JSON.parse(localStorage.getItem('fall-kit.config') || '{}'); }
    catch (e) { return {}; }
  }
  function saveConfig() {
    try { localStorage.setItem('fall-kit.config', JSON.stringify(STATE.config)); } catch (e) {}
  }
  // ─── DOM helpers ─────────────────────────────────────────────────
  function $(s, root) { return (root || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  // ─── AI tier ─────────────────────────────────────────────────────
  function aiTier() { return STATE.config.ai_tier || 'T0'; }
  function renderAiChip() {
    const chip = $('#fk-ai-chip');
    if (!chip) return;
    const txt = $('#fk-ai-chip-text');
    chip.classList.remove('fk-chip-live', 'fk-chip-loading', 'fk-chip-warn');
    const tier = aiTier();
    if (tier === 'T0') { txt.textContent = 'T0 · off'; }
    else if (tier === 'T2') {
      if (STATE.ai.ready) { txt.textContent = 'T2 ' + (WEBLLM_MODELS[STATE.config.webllm_model || DEFAULT_MODEL]?.label.split(' · ')[0] || '') + ' · ready'; chip.classList.add('fk-chip-live'); }
      else if (STATE.ai.loading) { txt.textContent = 'T2 loading ' + Math.round(STATE.ai.progress) + '%'; chip.classList.add('fk-chip-loading'); }
      else { txt.textContent = 'T2 · click to load'; chip.classList.add('fk-chip-warn'); }
    } else if (tier === 'T3') {
      if (STATE.config.api_key) { txt.textContent = 'T3 ' + (T3_PROVIDERS[STATE.config.api_provider]?.label || 'BYOK') + ' · active'; chip.classList.add('fk-chip-live'); }
      else { txt.textContent = 'T3 · no key set'; chip.classList.add('fk-chip-warn'); }
    }
  }
  async function loadWebLLM(modelKey) {
    if (STATE.ai.loading) return;
    const key = modelKey || STATE.config.webllm_model || DEFAULT_MODEL;
    const model = WEBLLM_MODELS[key];
    if (!model) { console.error('fall-kit: unknown model', key); return; }
    if (STATE.ai.ready && STATE.ai.model === model.id) return;
    STATE.ai.loading = true; STATE.ai.progress = 0; renderAiChip();
    notify('Loading WebLLM · ' + model.label + ' · ' + model.size + ' first time', 'info');
    try {
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm@0.2.79');
      const engine = await CreateMLCEngine(model.id, {
        initProgressCallback: p => { STATE.ai.progress = (p.progress || 0) * 100; renderAiChip(); }
      });
      STATE.ai.engine = engine;
      STATE.ai.model = model.id;
      STATE.ai.ready = true;
      STATE.ai.loading = false;
      STATE.config.webllm_model = key; saveConfig();
      renderAiChip();
      notify('WebLLM ready · sovereign mode · ' + model.label.split(' · ')[0], 'ok');
    } catch (e) {
      console.error('fall-kit: WebLLM load failed', e);
      STATE.ai.loading = false; renderAiChip();
      notify('WebLLM load failed · ' + e.message, 'err');
    }
  }
  async function aiComplete(systemPrompt, userMsg, maxTokens) {
    maxTokens = maxTokens || 600;
    const tier = aiTier();
    if (tier === 'T2' && STATE.ai.ready && STATE.ai.engine) {
      const r = await STATE.ai.engine.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        max_tokens: maxTokens,
      });
      return r.choices[0].message.content;
    }
    if (tier === 'T3' && STATE.config.api_key && STATE.config.api_provider) {
      return await aiCloudCall(systemPrompt, userMsg, maxTokens);
    }
    return null;
  }
  async function aiCloudCall(sys, msg, maxTokens) {
    const provider = STATE.config.api_provider;
    const key = STATE.config.api_key;
    const model = STATE.config.api_model || T3_PROVIDERS[provider]?.default;
    if (provider === 'anthropic') {
      const r = await fetch(T3_PROVIDERS.anthropic.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: sys, messages: [{ role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      return j.content[0].text;
    }
    if (provider === 'openai') {
      const r = await fetch(T3_PROVIDERS.openai.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('OpenAI ' + r.status);
      const j = await r.json();
      return j.choices[0].message.content;
    }
    if (provider === 'google') {
      const r = await fetch(T3_PROVIDERS.google.url + model + ':generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: sys + '\n\n---\n\n' + msg }] }], generationConfig: { maxOutputTokens: maxTokens } }),
      });
      if (!r.ok) throw new Error('Google ' + r.status);
      const j = await r.json();
      return j.candidates[0].content.parts[0].text;
    }
    throw new Error('unknown provider: ' + provider);
  }
  // ─── WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN) ───
  const MESH_CHANNEL = 'fall-signal';
  const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  function meshStart(opts) {
    if (STATE.mesh.active) return;
    opts = opts || {};
    const seedId = opts.seedId || (location.pathname + '#' + Math.random().toString(36).slice(2, 8));
    STATE.mesh.seedId = seedId;
    try { STATE.mesh.bc = new BroadcastChannel(MESH_CHANNEL); }
    catch (e) { console.warn('fall-kit: BroadcastChannel unavailable'); return; }
    STATE.mesh.bc.onmessage = e => {
      const m = e.data;
      if (!m || !m.kind || m.peerId === seedId) return;
      if (opts.onMessage) opts.onMessage(m);
    };
    STATE.mesh.bc.postMessage({ kind: 'fall-kit:hello', peerId: seedId, ts: Date.now(), seedName: opts.seedName || 'unknown' });
    STATE.mesh.active = true;
    notify('Mesh active · channel ' + MESH_CHANNEL, 'ok');
  }
  function meshPost(kind, payload) {
    if (!STATE.mesh.active || !STATE.mesh.bc) return false;
    STATE.mesh.bc.postMessage({ kind: kind, peerId: STATE.mesh.seedId, ts: Date.now(), payload: payload });
    return true;
  }
  // ─── Toast ───────────────────────────────────────────────────────
  function notify(msg, kind) {
    let t = $('#fk-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'fk-toast';
      t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(20px);background:#c08a3a;color:#0a0a0a;padding:9px 18px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;opacity:0;transition:all .22s;z-index:10000;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = kind === 'err' ? '#a14a2a' : kind === 'ok' ? '#6b8d4a' : '#c08a3a';
    t.style.color = kind === 'err' ? '#fff' : '#0a0a0a';
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._to);
    t._to = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; }, 2400);
  }
  // ─── Settings modal ──────────────────────────────────────────────
  function openSettings() {
    let bg = $('#fk-modal-bg');
    if (!bg) {
      bg = document.createElement('div'); bg.id = 'fk-modal-bg';
      bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;padding:60px 16px;overflow-y:auto;z-index:9999';
      bg.onclick = e => { if (e.target.id === 'fk-modal-bg') closeSettings(); };
      document.body.appendChild(bg);
    }
    const tier = aiTier();
    const provider = STATE.config.api_provider || 'anthropic';
    const providerCfg = T3_PROVIDERS[provider];
    bg.innerHTML = `
      <div style="background:#13121a;border:1px solid #c08a3a;border-radius:5px;max-width:600px;width:100%;padding:22px 24px;color:#ebe3d2;font-family:system-ui,-apple-system,sans-serif;font-size:13.5px;line-height:1.55">
        <div style="margin-bottom:14px"><label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Tier</label>
          <select id="fk-tier" style="width:100%;padding:8px 11px;background:#1a1922;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13.5px;font-family:inherit">
            <option value="T0"${tier==='T0'?' selected':''}>T0 · off (default · the seed works fully without AI)</option>
            <option value="T2"${tier==='T2'?' selected':''}>T2 · WebLLM in-browser · sovereign · pick a model below</option>
            <option value="T3"${tier==='T3'?' selected':''}>T3 · BYOK · Anthropic / OpenAI / Google · stored in your browser only</option>
          </select>
        </div>
        <div id="fk-t2-block" style="display:${tier==='T2'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">WebLLM model · 1B → 70B cascade</label>
          <select id="fk-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit">
            ${Object.entries(WEBLLM_MODELS).map(([k,m]) => `<option value="${k}"${(STATE.config.webllm_model||DEFAULT_MODEL)===k?' selected':''}>${esc(m.label)} · ${esc(m.size)}</option>`).join('')}
          </select>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button id="fk-load-llm" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">${STATE.ai.ready?'✓ Loaded · switch':'Load model (one-time download)'}</button>
            <span id="fk-llm-status" style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.04em">${STATE.ai.ready?'ready':STATE.ai.loading?Math.round(STATE.ai.progress)+'%':'not loaded'}</span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">First load downloads the model from @mlc-ai/web-llm CDN. Cached forever after. Inference is 100% local — open DevTools → Network during use, nothing leaves.</div>
        </div>
        <div id="fk-t3-block" style="display:${tier==='T3'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">BYOK provider</label>
          <select id="fk-provider" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${Object.entries(T3_PROVIDERS).map(([k,p]) => `<option value="${k}"${provider===k?' selected':''}>${esc(p.label)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Model</label>
          <select id="fk-api-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${providerCfg.models.map(m => `<option value="${m}"${(STATE.config.api_model||providerCfg.default)===m?' selected':''}>${esc(m)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">API key</label>
          <input type="password" id="fk-key" value="${esc(STATE.config.api_key || '')}" placeholder="${STATE.config.api_key ? '(set · leave empty to keep)' : 'sk-ant-... or sk-... or AIza...'}" autocomplete="off" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:ui-monospace,Menlo,monospace">
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">Key lives in this browser only (localStorage). Sent direct to the provider — never to us. Wipe with Reset.</div>
        </div>
        <div style="margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Cross-seed mesh</label>
          <div style="display:flex;gap:8px;align-items:center">
            <button id="fk-mesh-toggle" style="padding:6px 12px;background:${STATE.mesh.active?'#6b8d4a':'#1a1922'};color:${STATE.mesh.active?'#fff':'#a89e88'};border:1px solid ${STATE.mesh.active?'#6b8d4a':'#3a342c'};border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">${STATE.mesh.active?'✓ Active · disconnect':'Activate mesh'}</button>
            <span style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#6e6a5e;letter-spacing:.04em">channel · <code style="background:#22212c;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code></span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">BroadcastChannel for same-device · WebRTC for cross-device (planned). Other estate seeds on the same channel discover each other automatically.</div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button onclick="FallKit.closeSettings()" style="padding:7px 14px;background:transparent;color:#a89e88;border:1px solid #3a342c;border-radius:3px;font-size:12px;cursor:pointer;font-family:inherit">Close</button>
          <button id="fk-save" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">Save</button>
        </div>
      </div>`;
    // Wire interactions
    $('#fk-tier').onchange = () => {
      const t = $('#fk-tier').value;
      $('#fk-t2-block').style.display = t === 'T2' ? 'block' : 'none';
      $('#fk-t3-block').style.display = t === 'T3' ? 'block' : 'none';
    };
    $('#fk-provider') && ($('#fk-provider').onchange = () => {
      const p = $('#fk-provider').value;
      const sel = $('#fk-api-model');
      sel.innerHTML = T3_PROVIDERS[p].models.map(m => `<option value="${m}">${esc(m)}</option>`).join('');
    });
    $('#fk-load-llm') && ($('#fk-load-llm').onclick = () => {
      const m = $('#fk-model').value;
      loadWebLLM(m);
    });
    $('#fk-mesh-toggle').onclick = () => {
      if (STATE.mesh.active) { STATE.mesh.bc?.close(); STATE.mesh.active = false; STATE.mesh.bc = null; notify('Mesh disconnected'); }
      else meshStart({ seedName: STATE.config.seedName || 'seed' });
      openSettings();  // refresh modal
    };
    $('#fk-save').onclick = () => {
      STATE.config.ai_tier = $('#fk-tier').value;
      if ($('#fk-model')) STATE.config.webllm_model = $('#fk-model').value;
      if ($('#fk-provider')) STATE.config.api_provider = $('#fk-provider').value;
      if ($('#fk-api-model')) STATE.config.api_model = $('#fk-api-model').value;
      const newKey = $('#fk-key')?.value;
      if (newKey) STATE.config.api_key = newKey;
      saveConfig(); renderAiChip(); notify('Saved', 'ok'); closeSettings();
    };
  }
  function closeSettings() { const bg = $('#fk-modal-bg'); if (bg) bg.remove(); }
  // ─── Help section (returns HTML string for inclusion in seed Help tabs) ───
  function helpSection() {
    return `<div style="background:rgba(192,138,58,.05);border:1px solid #3a342c;border-radius:4px;padding:18px 22px;margin:14px 0">
      <p style="font-size:13px;color:#a89e88;line-height:1.7;margin-bottom:10px">This seed runs fully without AI (<strong style="color:#c08a3a">T0</strong>, default). Enable a tier in settings if you want AI-assist features:</p>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">Tier</th><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">What it is</th></tr></thead>
        <tbody>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T0</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">Off. The seed works fully. No AI · no downloads · no API calls.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T2</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">WebLLM in-browser. Pick a model: 1B (700MB, fast) → 3B (2GB, balanced) → 7B (5GB, capable) → 70B (40GB, frontier). One-time download, runs offline forever after. Zero data leaves your device.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T3</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">BYOK · Anthropic Claude · OpenAI GPT · Google Gemini. You bring the API key, you pay the provider direct. Key stays in your browser, sent direct to the provider, never proxied.</td></tr>
        </tbody>
      </table>
      <p style="font-size:12px;color:#6e6a5e;line-height:1.6;margin-top:10px">Open the AI chip in the header to switch tier or check status. Cross-seed mesh activates a BroadcastChannel on <code style="background:#1a1922;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code> so other estate seeds on the same device discover this one.</p>
    </div>`;
  }
  // ─── CSS for AI chip ─────────────────────────────────────────────
  function injectCss() {
    const s = document.createElement('style');
    s.id = 'fk-css';
    s.textContent = `
      #fk-ai-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border-radius:3px; font-family:ui-monospace,Menlo,monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; font-weight:600; cursor:pointer; border:1px solid #3a342c; background:#1a1922; color:#a89e88; user-select:none; vertical-align:middle }
      #fk-ai-chip:hover { border-color:#c08a3a; color:#ebe3d2 }
      #fk-ai-chip.fk-chip-live { border-color:#6b8d4a; color:#6b8d4a; background:rgba(107,141,74,.10) }
      #fk-ai-chip.fk-chip-loading { border-color:#e8a83a; color:#e8a83a; background:rgba(232,168,58,.10) }
      #fk-ai-chip.fk-chip-warn { border-color:#a14a2a; color:#a14a2a; background:rgba(161,74,42,.08) }
      #fk-ai-chip .fk-dot { width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0 }
      #fk-ai-chip.fk-chip-loading .fk-dot { animation:fk-pulse 1s infinite }
      @keyframes fk-pulse { 0%,100%{opacity:1}50%{opacity:.3} }
      .fk-ai-assist { display:inline-flex; align-items:center; gap:5px; padding:4px 9px; font-size:11px; border:1px solid #c08a3a; color:#c08a3a; background:transparent; border-radius:3px; cursor:pointer; font-family:inherit }
      .fk-ai-assist:hover { background:#c08a3a; color:#0a0a0a }
      .fk-ai-assist::before { content:'✦'; font-size:12px }
    `;
    document.head.appendChild(s);
  }
  // ─── KCC Mint launcher (v1.2 · fork-this-seed shortcut) ──────────
  function openMint() {
    const slug = (STATE.config.seedName || location.hostname.split('.')[0] || 'seed').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const url = location.href.split('?')[0].split('#')[0];
    const params = new URLSearchParams({ fork: '1', parent_slug: slug, parent_name: name, parent_url: url, parent_desc: desc });
  }
  // ─── Init ────────────────────────────────────────────────────────
  function init(opts) {
    opts = opts || {};
    injectCss();
    if (opts.seedName) STATE.config.seedName = opts.seedName;
    if ($('#fk-ai-chip')) { renderAiChip(); return { version: FALL_KIT_VERSION, mounted: false }; }
    const chip = document.createElement('button');
    chip.id = 'fk-ai-chip';
    chip.title = 'AI cascade · click to configure tier and model';
    chip.innerHTML = '<span class="fk-dot"></span><span id="fk-ai-chip-text">T0 · off</span>';
    chip.onclick = openSettings;
    // Try anchor first, fall back to floating bottom-right
    const anchor = opts.chipAnchor ? $(opts.chipAnchor) : null;
    if (anchor) { anchor.appendChild(chip); }
    else {
      chip.style.cssText += ';position:fixed;bottom:14px;left:14px;z-index:9998;box-shadow:0 4px 14px rgba(0,0,0,.4)';
      document.body.appendChild(chip);
    }
    // v1.2 · floating mint button next to chip
    if (!$('#fk-mint-btn') && !opts.hideMint) {
      const mintBtn = document.createElement('button');
      mintBtn.id = 'fk-mint-btn';
      mintBtn.title = 'Mint a fork of this seed as a KCC bundle · provenance economy';
      mintBtn.innerHTML = '<span style="font-size:13px">✦</span> mint fork';
      mintBtn.style.cssText = 'position:fixed;bottom:14px;left:130px;z-index:9998;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;cursor:pointer;border:1px solid #c08a3a;color:#c08a3a;background:rgba(10,10,15,.7);box-shadow:0 4px 14px rgba(0,0,0,.4)';
      mintBtn.onmouseover = () => { mintBtn.style.background = '#c08a3a'; mintBtn.style.color = '#0a0a0a'; };
      mintBtn.onmouseout  = () => { mintBtn.style.background = 'rgba(10,10,15,.7)'; mintBtn.style.color = '#c08a3a'; };
      mintBtn.onclick = openMint;
      document.body.appendChild(mintBtn);
    }
    renderAiChip();
    return { version: FALL_KIT_VERSION, mounted: true };
  }
  // ─── Public API ──────────────────────────────────────────────────
  root.FallKit = {
    version: FALL_KIT_VERSION,
    init: init,
    aiTier: aiTier,
    aiComplete: aiComplete,
    loadWebLLM: loadWebLLM,
    openSettings: openSettings,
    closeSettings: closeSettings,
    renderAiChip: renderAiChip,
    helpSection: helpSection,
    meshStart: meshStart,
    meshPost: meshPost,
    notify: notify,
    openMint: openMint,  // v1.2 · launch kcc-mint with this seed prefilled as parent
    MODELS: WEBLLM_MODELS,
    PROVIDERS: T3_PROVIDERS,
    state: STATE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
  // fall-kit init · auto-mounts a floating AI chip bottom-left
  (function () {
    function go() { if (typeof FallKit !== 'undefined') FallKit.init({ seedName: "fallestateonboard" }); }
    else go();
  })();
'use strict';
const TOOLNAME='fallestateonboard',VERSION='1.0.0',PRIME=887,STORE='fallestateonboard-v1';
const TABS=[
  {id:'dashboard',name:'Dashboard',ico:'◐'},
  {id:'firm',name:'Firm',ico:'⌂'},
  {id:'agents',name:'Agents',ico:'△'},
  {id:'help',name:'Q & A',ico:'?'},
];
const CLIENT_TYPES=['buyer','seller','landlord','tenant'];
const DOC_TYPES=[
  {id:'passport',label:'Passport',expiry:10*365},
  {id:'driving-licence',label:'Driving Licence',expiry:10*365},
  {id:'biometric-card',label:'Biometric Residence Card',expiry:10*365},
  {id:'share-code',label:'Home Office Share Code',expiry:90},
  {id:'utility-bill',label:'Utility Bill (3 months)',expiry:90},
  {id:'bank-statement',label:'Bank Statement',expiry:90},
  {id:'council-tax',label:'Council Tax Bill',expiry:365},
  {id:'employer-letter',label:'Employer Reference',expiry:90},
  {id:'landlord-ref',label:'Previous Landlord Reference',expiry:90},
  {id:'payslips',label:'Payslips (3 months)',expiry:90},
  {id:'guarantor-id',label:'Guarantor ID',expiry:365},
  {id:'other',label:'Other',expiry:365},
];
const RTR_DOCS=['passport','biometric-card','share-code'];
const HIGH_RISK_JURIS=['AF','BY','BI','CF','CD','CU','GN','GW','HT','IR','IQ','KP','LA','LB','LY','ML','MM','MZ','NI','PK','RU','SO','SS','SD','SY','TZ','VE','YE','ZW'];
const CMP_SCHEMES=['DPS','MyDeposits','TDS'];
let state={active:'dashboard',brandName:'FallEstateOnboard',
  firm:null,agents:[],clients:[],audit:[],
  ui:{filter:'all',search:'',selectedClientId:null,activeAgentId:null,wizard:null,chat:[],clientSubtab:'overview'},
  settings:{anthropicKey:'',auditChain:true,autoBroadcast:true},
};
const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>Array.from(p.querySelectorAll(s));
const uid=(p='id')=>p+'_'+Math.random().toString(36).slice(2,11);
const now=()=>Date.now();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const moneyP=n=>'£'+(+n||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const dateStr=ts=>{if(!ts)return '—';return new Date(ts).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})};
const dateTime=ts=>{if(!ts)return '—';return new Date(ts).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})};
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),1900)}
async function sha256(s){const buf=new TextEncoder().encode(s);const h=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')}
let db;
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(STORE,1);r.onupgradeneeded=e=>{const d=e.target.result;['state','audit','clients','agents','firms','documents'].forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:s==='state'?undefined:'id'})})};r.onsuccess=e=>{db=e.target.result;res(db)};r.onerror=rej})}
function idbGetAll(s){return new Promise(res=>{const tx=db.transaction(s,'readonly');const q=tx.objectStore(s).getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([])})}
function idbGet(s,k){return new Promise(res=>{const tx=db.transaction(s,'readonly');const q=tx.objectStore(s).get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(null)})}
function idbPut(s,v,k){return new Promise(res=>{const tx=db.transaction(s,'readwrite');const o=tx.objectStore(s);const q=k!=null?o.put(v,k):o.put(v);q.onsuccess=()=>res(true);q.onerror=()=>res(false)})}
async function loadAll(){
  if(!db)await openDB();
  const[firms,agents,clients,auditArr,uiState]=await Promise.all([idbGetAll('firms'),idbGetAll('agents'),idbGetAll('clients'),idbGetAll('audit'),idbGet('state','ui')]);
  state.firm=firms[0]||null;state.agents=agents;state.clients=clients;
  state.audit=auditArr.sort((a,b)=>a.i-b.i);
  if(uiState){state.ui=Object.assign({},state.ui,uiState.value||{});state.brandName=uiState.brand||'FallEstateOnboard';state.settings=Object.assign({},state.settings,uiState.settings||{});}
}
async function persistUI(){if(!db)await openDB();await idbPut('state',{value:{...state.ui,wizard:null},brand:state.brandName,settings:state.settings},'ui')}
async function auditLog(action,opts={}){
  if(!state.settings.auditChain)return;
  const prev=state.audit.length?state.audit[state.audit.length-1]:null;
  const prevHash=prev?prev.docHash:'';const i=(prev?prev.i:0)+1;
  const entry={id:uid('au'),i,ts:now(),tool:TOOLNAME,adviserId:opts.adviserId||'',clientId:opts.clientId||'',action,reasoning:opts.reasoning||'',configVersion:TOOLNAME+'@'+VERSION,prevHash,docHash:'',payload:opts.payload||{}};
  entry.docHash=await sha256(JSON.stringify({i,ts:entry.ts,action,clientId:entry.clientId,prevHash,payload:entry.payload}));
  state.audit.push(entry);await idbPut('audit',entry);
}
let bcEstate,bcSignal;
function initMesh(){
  try{bcSignal=new BroadcastChannel('fall-signal');bcSignal.postMessage({source:TOOLNAME,type:'hello',prime:PRIME,version:VERSION,ts:now()});bcSignal.addEventListener('message',e=>{if(e.data?.type==='ping')bcSignal.postMessage({source:TOOLNAME,type:'pong',prime:PRIME})})}catch(e){}
  try{bcEstate=new BroadcastChannel('fall-estate');bcEstate.addEventListener('message',async e=>{const m=e.data;if(!m||m.source===TOOLNAME)return;if(m.type==='sync.request')bcEstate.postMessage({v:1,type:'sync.snapshot',ts:now(),source:TOOLNAME,payload:{clients:state.clients,agents:state.agents,firm:state.firm}});});bcEstate.postMessage({v:1,type:'sync.request',ts:now(),source:TOOLNAME})}catch(e){}
}
function newClientRec(){
  return {
    id:uid('cl'),firmId:state.firm?state.firm.id:'',ts:now(),updatedAt:now(),archivedAt:null,
    clientType:'tenant',title:'Mr',firstName:'',lastName:'',dob:'',nationality:'GB',phone:'',email:'',
    address:'',postcode:'',
    employer:'',annualIncome:0,
    propertyAddress:'',propertyPostcode:'',rent:0,tenancyStart:'',tenancyEnd:'',tenancyType:'AST',
    aml:{idVerified:false,addressVerified:false,sourceOfFunds:'',sanctionsChecked:false,pepStatus:false,riskGrade:'low',riskReasons:[],cddComplete:false,notes:''},
    rtr:{checked:false,documentType:'',shareCode:'',expiryDate:'',followUpDate:'',rightConfirmed:false,restrictedUntil:'',notes:''},
    referencing:{creditCheck:false,employerRef:false,landlordRef:false,affordabilityCheck:false,guarantorRequired:false,guarantorName:'',guarantorRelationship:'',guarantorIncome:0,notes:''},
    vulnerable:{identified:false,category:'',details:'',adjustments:''},
    deposit:{amount:0,scheme:'',schemeRef:'',protectedDate:'',returnDue:''},
    documents:[],
    status:'new',agentId:'',isDemo:false,
  };
}
function clientDisplayName(c){return ((c.title?c.title+' ':'')+(c.firstName||'')+' '+(c.lastName||'')).trim()||'Unnamed';}
function assessAmlRisk(c){
  const aml=c.aml||{};let score=0;const reasons=[];
  if(aml.pepStatus){score+=3;reasons.push('PEP');}
  if(!aml.sanctionsChecked){score+=1;reasons.push('sanctions unchecked');}
  const nat=(c.nationality||'').toUpperCase();if(HIGH_RISK_JURIS.includes(nat)){score+=3;reasons.push('high-risk nationality');}
  if(c.rent>5000){score+=1;reasons.push('high rent >£5k');}
  if(c.clientType==='buyer'&&c.aml?.sourceOfFunds==='overseas'){score+=2;reasons.push('overseas source');}
  return {grade:score>=5?'high':score>=2?'medium':'low',score,reasons};
}
async function saveClient(c,action,reasoning){
  c.updatedAt=now();const risk=assessAmlRisk(c);c.aml.riskGrade=risk.grade;c.aml.riskReasons=risk.reasons;
  const idx=state.clients.findIndex(x=>x.id===c.id);if(idx>=0)state.clients[idx]=c;else state.clients.push(c);
  await idbPut('clients',c);await auditLog(action||'client.updated',{clientId:c.id,reasoning:reasoning||''});
}
async function saveFirm(f){f.updatedAt=now();state.firm=f;await idbPut('firms',f);await auditLog('firm.updated');}
async function saveAgent(a){a.updatedAt=now();const idx=state.agents.findIndex(x=>x.id===a.id);if(idx>=0)state.agents[idx]=a;else state.agents.push(a);await idbPut('agents',a);await auditLog('agent.updated',{payload:{agentId:a.id}});}
function render(){renderTabs();const v=$('#view');
  if(state.ui.wizard){renderWizard(v);return;}
  switch(state.active){
    case 'dashboard':return renderDashboard(v);case 'clients':return state.ui.selectedClientId?renderClientDetail(v):renderClientList(v);
    case 'firm':return renderFirm(v);case 'agents':return renderAgents(v);case 'help':return renderHelp(v);
  }
}
function renderTabs(){$('#nav').innerHTML=TABS.map(t=>`<button class="${state.active===t.id?'active':''}" onclick="switchTab('${t.id}')">${t.ico} ${t.name}</button>`).join('');}
function switchTab(id){state.active=id;state.ui.selectedClientId=null;state.ui.wizard=null;persistUI();render();}
function renderDashboard(v){
  const cls=state.clients.filter(c=>!c.archivedAt);
  const tenants=cls.filter(c=>c.clientType==='tenant');const buyers=cls.filter(c=>c.clientType==='buyer');
  const rtrDue=tenants.filter(c=>!c.rtr?.rightConfirmed).length;
  const amlDue=cls.filter(c=>!c.aml?.cddComplete).length;
  const refDue=tenants.filter(c=>!c.referencing?.creditCheck).length;
  const vuln=cls.filter(c=>c.vulnerable?.identified).length;
  const highRisk=cls.filter(c=>c.aml?.riskGrade==='high').length;
  v.innerHTML=`
    <div class="disclaimer"><strong>◆ Regulatory notice:</strong> FallEstateOnboard assists with MLR 2017 AML CDD, Immigration Act 2014 Right-to-Rent checks, and tenant referencing. It does not replace the agent's professional judgment or legal obligations. Retain records per HMRC/Home Office requirements. Data never leaves this device.</div>
    <div class="section-h"><h2>Dashboard</h2><div class="sub">fallestateonboard · prime 887</div></div>
    <div class="dash-kpis">
      <div class="dash-kpi"><div class="n">${cls.length}</div><div class="l">Total clients</div></div>
      <div class="dash-kpi"><div class="n">${tenants.length}</div><div class="l">Tenants</div></div>
      <div class="dash-kpi"><div class="n">${buyers.length}</div><div class="l">Buyers</div></div>
      <div class="dash-kpi ${rtrDue?'warn':'ok'}"><div class="n">${rtrDue}</div><div class="l">RTR due</div></div>
      <div class="dash-kpi ${amlDue?'due':''}"><div class="n">${amlDue}</div><div class="l">AML incomplete</div></div>
      <div class="dash-kpi ${refDue?'warn':''}"><div class="n">${refDue}</div><div class="l">Ref incomplete</div></div>
      <div class="dash-kpi"><div class="n">${vuln}</div><div class="l">Vulnerable</div></div>
      <div class="dash-kpi ${highRisk?'due':''}"><div class="n">${highRisk}</div><div class="l">High risk</div></div>
    </div>`;
}
function renderClientList(v){
  const filter=state.ui.filter||'all';
  let cls=state.clients.filter(c=>!c.archivedAt);
  if(filter!=='all')cls=cls.filter(c=>filter==='aml-due'?!c.aml?.cddComplete:filter==='rtr-due'?c.clientType==='tenant'&&!c.rtr?.rightConfirmed:filter==='high-risk'?c.aml?.riskGrade==='high':c.clientType===filter);
  const q=(state.ui.search||'').toLowerCase();if(q)cls=cls.filter(c=>clientDisplayName(c).toLowerCase().includes(q));
  cls.sort((a,b)=>b.updatedAt-a.updatedAt);
  v.innerHTML=`
    <div class="section-h"><h2>Clients</h2><div class="sub">${cls.length} shown</div></div>
    <div class="chip-row">${['all','tenant','buyer','seller','landlord','aml-due','rtr-due','high-risk'].map(f=>`<button class="chip ${filter===f?'active':''}" onclick="state.ui.filter='${f}';render()">${f}</button>`).join('')}</div>
    <div class="field" style="max-width:400px;margin-bottom:14px"><input placeholder="Search…" value="${esc(state.ui.search||'')}" oninput="state.ui.search=this.value;render()"></div>
    ${cls.length?`<table><thead><tr><th>Name</th><th>Type</th><th>Status</th><th>AML</th><th>RTR</th><th>Updated</th></tr></thead><tbody>${cls.map(c=>`<tr class="row-link" onclick="openClient('${c.id}')"><td>${esc(clientDisplayName(c))}${c.isDemo?' <span class="tag muted">demo</span>':''}</td><td>${esc(c.clientType)}</td><td><span class="tag ${c.status==='complete'?'green':c.status==='in-progress'?'amber':'muted'}">${c.status}</span></td><td><span class="tag ${c.aml?.riskGrade==='high'?'red':c.aml?.riskGrade==='medium'?'amber':'green'}">${c.aml?.riskGrade||'—'}</span></td><td>${c.clientType==='tenant'?c.rtr?.rightConfirmed?'<span class="tag green">ok</span>':'<span class="tag amber">due</span>':'—'}</td><td>${dateStr(c.updatedAt)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty"><div class="big">No matching clients</div></div>'}`;
}
function openClient(id){state.ui.selectedClientId=id;state.active='clients';state.ui.clientSubtab='overview';render();}
function renderClientDetail(v){
  const c=state.clients.find(x=>x.id===state.ui.selectedClientId);if(!c){state.ui.selectedClientId=null;renderClientList(v);return;}
  const sub=state.ui.clientSubtab||'overview';
  v.innerHTML=`
    <div style="margin-bottom:14px"><button class="btn ghost sm" onclick="state.ui.selectedClientId=null;render()">← Back</button></div>
    <div class="section-h"><h2>${esc(clientDisplayName(c))}</h2><div class="actions">
      <button class="btn primary sm" onclick="resumeWizard('${c.id}')">Edit</button>
      <button class="btn ghost sm" onclick="archiveClient('${c.id}')">Archive</button>
    </div></div>
    <div class="subtab-row">${['overview','aml','rtr','referencing','vulnerable','deposit','documents'].map(t=>`<div class="subtab ${sub===t?'active':''}" onclick="state.ui.clientSubtab='${t}';render()">${t}</div>`).join('')}</div>
    ${sub==='overview'?renderOverview(c):''}${sub==='aml'?renderAml(c):''}${sub==='rtr'?renderRtr(c):''}
    ${sub==='referencing'?renderRef(c):''}${sub==='vulnerable'?renderVuln(c):''}
    ${sub==='deposit'?renderDeposit(c):''}${sub==='documents'?renderDocs(c):''}`;
}
function renderOverview(c){
  return `<div class="grid-2">
    <div class="card"><h3>Details</h3>
      <div class="kpi"><span class="l">Type</span><span class="v">${esc(c.clientType)}</span></div>
      <div class="kpi"><span class="l">Name</span><span class="v">${esc(c.title)} ${esc(c.firstName)} ${esc(c.lastName)}</span></div>
      <div class="kpi"><span class="l">DOB</span><span class="v">${esc(c.dob)}</span></div>
      <div class="kpi"><span class="l">Nationality</span><span class="v">${esc(c.nationality)}</span></div>
      <div class="kpi"><span class="l">Phone</span><span class="v">${esc(c.phone)}</span></div>
      <div class="kpi"><span class="l">Email</span><span class="v">${esc(c.email)}</span></div>
    </div>
    <div class="card"><h3>Status</h3>
      <div class="kpi"><span class="l">Status</span><span class="v">${esc(c.status)}</span></div>
      <div class="kpi"><span class="l">AML risk</span><span class="v ${c.aml?.riskGrade==='high'?'red':c.aml?.riskGrade==='medium'?'amber':'green'}">${c.aml?.riskGrade}</span></div>
      <div class="kpi"><span class="l">CDD complete</span><span class="v ${c.aml?.cddComplete?'green':'red'}">${c.aml?.cddComplete?'Yes':'No'}</span></div>
      ${c.clientType==='tenant'?`<div class="kpi"><span class="l">Right to Rent</span><span class="v ${c.rtr?.rightConfirmed?'green':'red'}">${c.rtr?.rightConfirmed?'Confirmed':'Pending'}</span></div>`:''}
      <div class="kpi"><span class="l">Documents</span><span class="v">${(c.documents||[]).length}</span></div>
    </div>
    ${c.clientType==='tenant'?`<div class="card"><h3>Tenancy</h3>
      <div class="kpi"><span class="l">Property</span><span class="v">${esc(c.propertyAddress)}</span></div>
      <div class="kpi"><span class="l">Rent</span><span class="v">${moneyP(c.rent)}/pcm</span></div>
      <div class="kpi"><span class="l">Start</span><span class="v">${esc(c.tenancyStart)}</span></div>
      <div class="kpi"><span class="l">Type</span><span class="v">${esc(c.tenancyType)}</span></div>
    </div>`:''}
  </div>`;
}
function renderAml(c){const a=c.aml||{};const risk=assessAmlRisk(c);
  return `<div class="card"><h3>AML CDD (MLR 2017)</h3>
    <div class="kpi"><span class="l">ID verified</span><span class="v ${a.idVerified?'green':'red'}">${a.idVerified?'Yes':'No'}</span></div>
    <div class="kpi"><span class="l">Address verified</span><span class="v ${a.addressVerified?'green':'red'}">${a.addressVerified?'Yes':'No'}</span></div>
    <div class="kpi"><span class="l">Source of funds</span><span class="v">${esc(a.sourceOfFunds)}</span></div>
    <div class="kpi"><span class="l">Sanctions checked</span><span class="v ${a.sanctionsChecked?'green':'red'}">${a.sanctionsChecked?'Yes':'No'}</span></div>
    <div class="kpi"><span class="l">PEP</span><span class="v ${a.pepStatus?'red':''}">${a.pepStatus?'Yes':'No'}</span></div>
    <div class="kpi"><span class="l">Risk grade</span><span class="v ${risk.grade==='high'?'red':risk.grade==='medium'?'amber':'green'}">${risk.grade} (${risk.score})</span></div>
    ${risk.reasons.length?`<div style="margin-top:6px">${risk.reasons.map(r=>`<span class="tag amber">${esc(r)}</span>`).join(' ')}</div>`:''}
    <div class="kpi"><span class="l">CDD complete</span><span class="v ${a.cddComplete?'green':'red'}">${a.cddComplete?'Yes':'No'}</span></div>
  </div>`;
}
function renderRtr(c){const r=c.rtr||{};
  return `<div class="card"><h3>Right to Rent (Immigration Act 2014)</h3>
    ${c.clientType!=='tenant'?'<p style="color:var(--cream-dim);font-size:12px">RTR checks apply to tenants only.</p>':`
    <div class="kpi"><span class="l">Check completed</span><span class="v ${r.checked?'green':'red'}">${r.checked?'Yes':'No'}</span></div>
    <div class="kpi"><span class="l">Document type</span><span class="v">${esc(r.documentType)}</span></div>
    <div class="kpi"><span class="l">Share code</span><span class="v">${esc(r.shareCode)}</span></div>
    <div class="kpi"><span class="l">Right confirmed</span><span class="v ${r.rightConfirmed?'green':'red'}">${r.rightConfirmed?'Yes':'No'}</span></div>
    ${r.restrictedUntil?`<div class="kpi"><span class="l">Time-limited until</span><span class="v amber">${esc(r.restrictedUntil)}</span></div>`:''}
    ${r.followUpDate?`<div class="kpi"><span class="l">Follow-up date</span><span class="v">${esc(r.followUpDate)}</span></div>`:''}
    <div class="kpi"><span class="l">Notes</span><span class="v">${esc(r.notes)}</span></div>`}
  </div>`;
}
function renderRef(c){const r=c.referencing||{};
  return `<div class="card"><h3>Tenant Referencing</h3>
    <div class="kpi"><span class="l">Credit check</span><span class="v ${r.creditCheck?'green':'red'}">${r.creditCheck?'Done':'Pending'}</span></div>
    <div class="kpi"><span class="l">Employer ref</span><span class="v ${r.employerRef?'green':'red'}">${r.employerRef?'Done':'Pending'}</span></div>
    <div class="kpi"><span class="l">Landlord ref</span><span class="v ${r.landlordRef?'green':'red'}">${r.landlordRef?'Done':'Pending'}</span></div>
    <div class="kpi"><span class="l">Affordability</span><span class="v ${r.affordabilityCheck?'green':'red'}">${r.affordabilityCheck?'Done':'Pending'}</span></div>
    <div class="kpi"><span class="l">Guarantor required</span><span class="v">${r.guarantorRequired?'Yes':'No'}</span></div>
    ${r.guarantorRequired?`<div class="kpi"><span class="l">Guarantor</span><span class="v">${esc(r.guarantorName)} (${esc(r.guarantorRelationship)})</span></div><div class="kpi"><span class="l">Guarantor income</span><span class="v">${moneyP(r.guarantorIncome)}</span></div>`:''}
  </div>`;
}
function renderVuln(c){const v=c.vulnerable||{};
  return `<div class="card"><h3>Vulnerable Customer</h3>
    <div class="kpi"><span class="l">Identified</span><span class="v ${v.identified?'amber':''}">${v.identified?'Yes':'No'}</span></div>
    ${v.identified?`<div class="kpi"><span class="l">Category</span><span class="v">${esc(v.category)}</span></div>
    <div class="kpi"><span class="l">Details</span><span class="v">${esc(v.details)}</span></div>
    <div class="kpi"><span class="l">Adjustments</span><span class="v">${esc(v.adjustments)}</span></div>`:''}
  </div>`;
}
function renderDeposit(c){const d=c.deposit||{};
  return `<div class="card"><h3>Tenancy Deposit</h3>
    ${c.clientType!=='tenant'?'<p style="color:var(--cream-dim);font-size:12px">Deposit protection applies to tenants only.</p>':`
    <div class="kpi"><span class="l">Amount</span><span class="v">${moneyP(d.amount)}</span></div>
    <div class="kpi"><span class="l">Scheme</span><span class="v">${esc(d.scheme)}</span></div>
    <div class="kpi"><span class="l">Scheme ref</span><span class="v">${esc(d.schemeRef)}</span></div>
    <div class="kpi"><span class="l">Protected date</span><span class="v">${esc(d.protectedDate)}</span></div>`}
  </div>`;
}
function renderDocs(c){const docs=c.documents||[];
  return `<div class="card"><h3>Documents <span class="meta">${docs.length}</span></h3>
    ${docs.length?`<div class="doc-list">${docs.map(d=>{const expired=d.expiresAt&&d.expiresAt<now();return `<div class="doc-row"><span class="dtype">${esc(d.type)}</span><span class="dname">${esc(d.name)}</span><span class="dmeta">${expired?'<span class="tag red">expired</span>':dateStr(d.expiresAt)}</span><span class="dhash">${esc(d.sha256)}</span></div>`;}).join('')}</div>`:'<p style="color:var(--cream-dim);font-size:12px">No documents uploaded.</p>'}
  </div>`;
}
async function archiveClient(id){if(!confirm('Archive?'))return;const c=state.clients.find(x=>x.id===id);if(!c)return;c.archivedAt=now();await saveClient(c,'client.archived');state.ui.selectedClientId=null;toast('Archived');render();}
// WIZARD
const WIZ_STEPS=[{id:'type',name:'Type'},{id:'details',name:'Details'},{id:'contact',name:'Contact'},
  {id:'tenancy',name:'Tenancy'},{id:'aml',name:'AML'},{id:'rtr',name:'RTR'},
  {id:'referencing',name:'Referencing'},{id:'vulnerable',name:'Vulnerable'},{id:'deposit',name:'Deposit'},{id:'documents',name:'Docs'}];
function newClient(){const c=newClientRec();c.agentId=state.ui.activeAgentId||'';state.ui.wizard={clientId:c.id,step:0,client:c,fresh:true};render();}
function resumeWizard(id){const c=state.clients.find(x=>x.id===id);if(!c)return;state.ui.wizard={clientId:c.id,step:0,client:JSON.parse(JSON.stringify(c)),fresh:false};render();}
function getSteps(c){
  let steps=[...WIZ_STEPS];
  if(c.clientType!=='tenant')steps=steps.filter(s=>!['tenancy','rtr','referencing','deposit'].includes(s.id));
  return steps;
}
function renderWizard(v){
  const w=state.ui.wizard;if(!w)return;const steps=getSteps(w.client);const cur=steps[w.step]||steps[0];
  v.innerHTML=`<div class="wizard"><div class="wizard-steps">${steps.map((s,i)=>`<div class="wstep ${i<w.step?'done':''} ${i===w.step?'active':''}" onclick="jumpStep(${i})"><span class="n">${i+1}</span>${s.name}</div>`).join('')}</div><div class="wizard-body" id="wizBody"></div><div class="wizard-foot"><button class="btn ghost" onclick="${w.step>0?'prevStep()':'cancelWizard()'}">${w.step>0?'← Back':'Cancel'}</button><button class="btn primary" onclick="${w.step<steps.length-1?'nextStep()':'commitWizard()'}">${w.step<steps.length-1?'Next →':'Commit'}</button></div></div>`;
  renderStep(cur.id,w.client);
}
function renderStep(id,c){
  const b=$('#wizBody');if(!b)return;
  switch(id){
    case 'type':b.innerHTML=`<h3>Client Type</h3><div class="step-sub">What type of client is this?</div><div class="field"><label>Type</label><select id="wType">${CLIENT_TYPES.map(t=>`<option value="${t}" ${c.clientType===t?'selected':''}>${t}</option>`).join('')}</select></div>`;break;
    case 'details':b.innerHTML=`<h3>Personal Details</h3><div class="row"><div class="field"><label>Title</label><select id="wTitle">${['Mr','Mrs','Ms','Miss','Dr'].map(t=>`<option ${c.title===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label>First name<span class="req">*</span></label><input id="wFirst" value="${esc(c.firstName)}"></div></div><div class="row"><div class="field"><label>Last name<span class="req">*</span></label><input id="wLast" value="${esc(c.lastName)}"></div><div class="field"><label>DOB</label><input type="date" id="wDob" value="${esc(c.dob)}"></div></div><div class="row"><div class="field"><label>Nationality</label><input id="wNat" value="${esc(c.nationality)}"></div><div class="field"><label>Employer</label><input id="wEmp" value="${esc(c.employer)}"></div></div><div class="field"><label>Annual income</label><input type="number" id="wIncome" value="${c.annualIncome||0}"></div>`;break;
    case 'contact':b.innerHTML=`<h3>Contact</h3><div class="row"><div class="field"><label>Phone</label><input id="wPhone" value="${esc(c.phone)}"></div><div class="field"><label>Email</label><input type="email" id="wEmail" value="${esc(c.email)}"></div></div><div class="field"><label>Address</label><input id="wAddr" value="${esc(c.address)}"></div><div class="field"><label>Postcode</label><input id="wPost" value="${esc(c.postcode)}"></div>`;break;
    case 'tenancy':b.innerHTML=`<h3>Tenancy Details</h3><div class="field"><label>Property address</label><input id="wPropAddr" value="${esc(c.propertyAddress)}"></div><div class="row"><div class="field"><label>Postcode</label><input id="wPropPost" value="${esc(c.propertyPostcode)}"></div><div class="field"><label>Monthly rent</label><input type="number" id="wRent" value="${c.rent||0}"></div></div><div class="row"><div class="field"><label>Start date</label><input type="date" id="wTenStart" value="${esc(c.tenancyStart)}"></div><div class="field"><label>End date</label><input type="date" id="wTenEnd" value="${esc(c.tenancyEnd)}"></div></div><div class="field"><label>Tenancy type</label><select id="wTenType">${['AST','Contractual','Company Let','HMO','Other'].map(t=>`<option ${c.tenancyType===t?'selected':''}>${t}</option>`).join('')}</select></div>`;break;
    case 'aml':const am=c.aml;b.innerHTML=`<h3>AML CDD (MLR 2017)</h3><div class="step-sub">Estate/letting agents must conduct CDD for property transactions ≥€10,000</div>
      <div style="margin-bottom:8px"><label style="font-size:13px"><input type="checkbox" id="wIdVer" ${am.idVerified?'checked':''}> ID verified</label></div>
      <div style="margin-bottom:8px"><label style="font-size:13px"><input type="checkbox" id="wAddrVer" ${am.addressVerified?'checked':''}> Address verified</label></div>
      <div class="field"><label>Source of funds</label><select id="wSoF"><option value="">—</option>${['savings','employment','inheritance','sale-of-property','overseas','other'].map(t=>`<option value="${t}" ${am.sourceOfFunds===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div style="margin-bottom:8px"><label style="font-size:13px"><input type="checkbox" id="wSanChk" ${am.sanctionsChecked?'checked':''}> Sanctions checked</label></div>
      <div style="margin-bottom:8px"><label style="font-size:13px"><input type="checkbox" id="wPep" ${am.pepStatus?'checked':''}> PEP</label></div>
      <div style="margin-bottom:8px"><label style="font-size:13px"><input type="checkbox" id="wCddDone" ${am.cddComplete?'checked':''}> CDD complete</label></div>
      <div class="field"><label>Notes</label><textarea id="wAmlNotes" rows="2">${esc(am.notes)}</textarea></div>`;break;
    case 'rtr':const rr=c.rtr;b.innerHTML=`<h3>Right to Rent</h3><div class="step-sub">Immigration Act 2014 — check before granting tenancy</div>
      <div style="margin-bottom:8px"><label style="font-size:13px"><input type="checkbox" id="wRtrChk" ${rr.checked?'checked':''}> Check completed</label></div>
      <div class="field"><label>Document type</label><select id="wRtrDoc"><option value="">—</option>${['UK/Irish passport','EU Settlement Scheme','Biometric Residence Permit','Home Office share code','Right to Rent letter','Other'].map(t=>`<option ${rr.documentType===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Share code (if applicable)</label><input id="wShareCode" value="${esc(rr.shareCode)}"></div>
      <div style="margin-bottom:8px"><label style="font-size:13px"><input type="checkbox" id="wRtrOk" ${rr.rightConfirmed?'checked':''}> Right to rent confirmed</label></div>
      <div class="row"><div class="field"><label>Time-limited until</label><input type="date" id="wRtrLimit" value="${esc(rr.restrictedUntil)}"></div><div class="field"><label>Follow-up date</label><input type="date" id="wRtrFollow" value="${esc(rr.followUpDate)}"></div></div>
      <div class="field"><label>Notes</label><textarea id="wRtrNotes" rows="2">${esc(rr.notes)}</textarea></div>`;break;
    case 'referencing':const rf=c.referencing;b.innerHTML=`<h3>Tenant Referencing</h3>
      <div style="margin-bottom:8px"><label style="font-size:13px"><input type="checkbox" id="wRefCredit" ${rf.creditCheck?'checked':''}> Credit check completed</label></div>
      <div style="margin-bottom:8px"><label style="font-size:13px"><input type="checkbox" id="wRefEmp" ${rf.employerRef?'checked':''}> Employer reference obtained</label></div>
      <div style="margin-bottom:8px"><label style="font-size:13px"><input type="checkbox" id="wRefLl" ${rf.landlordRef?'checked':''}> Previous landlord reference obtained</label></div>
      <div style="margin-bottom:8px"><label style="font-size:13px"><input type="checkbox" id="wRefAff" ${rf.affordabilityCheck?'checked':''}> Affordability check completed</label></div>
      <div style="margin-bottom:10px"><label style="font-size:13px"><input type="checkbox" id="wRefGuar" ${rf.guarantorRequired?'checked':''}> Guarantor required</label></div>
      <div id="guarFields" style="display:${rf.guarantorRequired?'block':'none'}">
        <div class="row"><div class="field"><label>Guarantor name</label><input id="wGuarName" value="${esc(rf.guarantorName)}"></div><div class="field"><label>Relationship</label><input id="wGuarRel" value="${esc(rf.guarantorRelationship)}"></div></div>
        <div class="field"><label>Guarantor annual income</label><input type="number" id="wGuarInc" value="${rf.guarantorIncome||0}"></div>
      </div>`;
      setTimeout(()=>{const cb=$('#wRefGuar');if(cb)cb.addEventListener('change',()=>{const gf=$('#guarFields');if(gf)gf.style.display=cb.checked?'block':'none';});},50);break;
    case 'vulnerable':const vu=c.vulnerable;b.innerHTML=`<h3>Vulnerable Customer</h3>
      <div style="margin-bottom:10px"><label style="font-size:13px"><input type="checkbox" id="wVulnId" ${vu.identified?'checked':''}> Vulnerability identified</label></div>
      <div id="vulnFields" style="display:${vu.identified?'block':'none'}">
        <div class="field"><label>Category</label><select id="wVulnCat"><option value="">—</option>${['health','life-event','resilience','capability'].map(t=>`<option value="${t}" ${vu.category===t?'selected':''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Details</label><textarea id="wVulnDetails" rows="2">${esc(vu.details)}</textarea></div>
        <div class="field"><label>Adjustments</label><textarea id="wVulnAdj" rows="2">${esc(vu.adjustments)}</textarea></div>
      </div>`;
      setTimeout(()=>{const cb=$('#wVulnId');if(cb)cb.addEventListener('change',()=>{const vf=$('#vulnFields');if(vf)vf.style.display=cb.checked?'block':'none';});},50);break;
    case 'deposit':const dp=c.deposit;b.innerHTML=`<h3>Tenancy Deposit</h3><div class="step-sub">Housing Act 2004 — protect within 30 days of receipt</div>
      <div class="row"><div class="field"><label>Deposit amount</label><input type="number" id="wDepAmt" value="${dp.amount||0}"></div><div class="field"><label>Scheme</label><select id="wDepScheme"><option value="">—</option>${CMP_SCHEMES.map(s=>`<option ${dp.scheme===s?'selected':''}>${s}</option>`).join('')}</select></div></div>
      <div class="row"><div class="field"><label>Scheme reference</label><input id="wDepRef" value="${esc(dp.schemeRef)}"></div><div class="field"><label>Protected date</label><input type="date" id="wDepDate" value="${esc(dp.protectedDate)}"></div></div>`;break;
    case 'documents':b.innerHTML=`<h3>Document Capture</h3>
      <input type="file" id="fileInput" style="display:none" multiple onchange="handleFiles(this.files)">
      <div class="row" style="margin-top:10px"><div class="field"><label>Document type</label><select id="wDocType">${DOC_TYPES.map(d=>`<option value="${d.id}">${d.label}</option>`).join('')}</select></div></div>
      <div class="doc-list" id="wizDocList">${(c.documents||[]).map(d=>`<div class="doc-row"><span class="dtype">${esc(d.type)}</span><span class="dname">${esc(d.name)}</span><span class="dhash">${esc(d.sha256)}</span></div>`).join('')}</div>`;
      setTimeout(()=>{const dz=$('#dropZone');if(dz){dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('hover');});dz.addEventListener('dragleave',()=>dz.classList.remove('hover'));dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('hover');handleFiles(e.dataTransfer.files);});}},50);break;
  }
}
async function handleFiles(files){
  if(!files||!files.length)return;const w=state.ui.wizard;if(!w)return;
  const docType=$('#wDocType')?.value||'other';
  for(const file of files){
    const buf=await file.arrayBuffer();const hash=await sha256(new TextDecoder().decode(new Uint8Array(buf).slice(0,1024)));
    const meta={id:uid('doc'),clientId:w.clientId,type:docType,name:file.name,size:file.size,sha256:hash.slice(0,16),uploadedAt:now(),expiresAt:null};
    const dt=DOC_TYPES.find(d=>d.id===docType);if(dt)meta.expiresAt=now()+dt.expiry*86400000;
    w.client.documents.push(meta);
  }
  toast(files.length+' file(s) captured');
  const list=$('#wizDocList');if(list)list.innerHTML=w.client.documents.map(d=>`<div class="doc-row"><span class="dtype">${esc(d.type)}</span><span class="dname">${esc(d.name)}</span><span class="dhash">${esc(d.sha256)}</span></div>`).join('');
}
function collectStep(id,c){
  switch(id){
    case 'type':c.clientType=$('#wType')?.value||'tenant';break;
    case 'details':c.title=$('#wTitle')?.value||'';c.firstName=$('#wFirst')?.value.trim()||'';c.lastName=$('#wLast')?.value.trim()||'';c.dob=$('#wDob')?.value||'';c.nationality=$('#wNat')?.value.trim()||'GB';c.employer=$('#wEmp')?.value.trim()||'';c.annualIncome=parseFloat($('#wIncome')?.value)||0;break;
    case 'contact':c.phone=$('#wPhone')?.value.trim()||'';c.email=$('#wEmail')?.value.trim()||'';c.address=$('#wAddr')?.value.trim()||'';c.postcode=$('#wPost')?.value.trim()||'';break;
    case 'tenancy':c.propertyAddress=$('#wPropAddr')?.value.trim()||'';c.propertyPostcode=$('#wPropPost')?.value.trim()||'';c.rent=parseFloat($('#wRent')?.value)||0;c.tenancyStart=$('#wTenStart')?.value||'';c.tenancyEnd=$('#wTenEnd')?.value||'';c.tenancyType=$('#wTenType')?.value||'AST';break;
    case 'aml':c.aml.idVerified=$('#wIdVer')?.checked||false;c.aml.addressVerified=$('#wAddrVer')?.checked||false;c.aml.sourceOfFunds=$('#wSoF')?.value||'';c.aml.sanctionsChecked=$('#wSanChk')?.checked||false;c.aml.pepStatus=$('#wPep')?.checked||false;c.aml.cddComplete=$('#wCddDone')?.checked||false;c.aml.notes=$('#wAmlNotes')?.value.trim()||'';break;
    case 'rtr':c.rtr.checked=$('#wRtrChk')?.checked||false;c.rtr.documentType=$('#wRtrDoc')?.value||'';c.rtr.shareCode=$('#wShareCode')?.value.trim()||'';c.rtr.rightConfirmed=$('#wRtrOk')?.checked||false;c.rtr.restrictedUntil=$('#wRtrLimit')?.value||'';c.rtr.followUpDate=$('#wRtrFollow')?.value||'';c.rtr.notes=$('#wRtrNotes')?.value.trim()||'';break;
    case 'referencing':c.referencing.creditCheck=$('#wRefCredit')?.checked||false;c.referencing.employerRef=$('#wRefEmp')?.checked||false;c.referencing.landlordRef=$('#wRefLl')?.checked||false;c.referencing.affordabilityCheck=$('#wRefAff')?.checked||false;c.referencing.guarantorRequired=$('#wRefGuar')?.checked||false;if(c.referencing.guarantorRequired){c.referencing.guarantorName=$('#wGuarName')?.value.trim()||'';c.referencing.guarantorRelationship=$('#wGuarRel')?.value.trim()||'';c.referencing.guarantorIncome=parseFloat($('#wGuarInc')?.value)||0;}break;
    case 'vulnerable':c.vulnerable.identified=$('#wVulnId')?.checked||false;if(c.vulnerable.identified){c.vulnerable.category=$('#wVulnCat')?.value||'';c.vulnerable.details=$('#wVulnDetails')?.value.trim()||'';c.vulnerable.adjustments=$('#wVulnAdj')?.value.trim()||'';}break;
    case 'deposit':c.deposit.amount=parseFloat($('#wDepAmt')?.value)||0;c.deposit.scheme=$('#wDepScheme')?.value||'';c.deposit.schemeRef=$('#wDepRef')?.value.trim()||'';c.deposit.protectedDate=$('#wDepDate')?.value||'';break;
  }
}
function nextStep(){const w=state.ui.wizard;if(!w)return;const steps=getSteps(w.client);collectStep(steps[w.step].id,w.client);if(w.step<steps.length-1){w.step++;render();}}
function prevStep(){const w=state.ui.wizard;if(!w)return;const steps=getSteps(w.client);collectStep(steps[w.step].id,w.client);if(w.step>0){w.step--;render();}}
function jumpStep(i){const w=state.ui.wizard;if(!w)return;const steps=getSteps(w.client);collectStep(steps[w.step].id,w.client);w.step=i;render();}
function cancelWizard(){if(!confirm('Cancel?'))return;state.ui.wizard=null;render();}
async function commitWizard(){
  const w=state.ui.wizard;if(!w)return;const steps=getSteps(w.client);collectStep(steps[w.step].id,w.client);
  const c=w.client;if(!c.firstName||!c.lastName){toast('Name required');return;}
  c.status=c.aml?.cddComplete&&(c.clientType!=='tenant'||c.rtr?.rightConfirmed)?'complete':'in-progress';
  c.agentId=state.ui.activeAgentId||'';
  await saveClient(c,w.fresh?'client.created':'client.updated',w.fresh?'wizard commit':'wizard update');
  state.ui.wizard=null;state.ui.selectedClientId=c.id;state.active='clients';toast('Client committed');persistUI();render();
}
// FIRM
function renderFirm(v){const f=state.firm||{};
  v.innerHTML=`<div class="section-h"><h2>Firm Setup</h2></div><div class="card" style="max-width:620px">
    <div class="row"><div class="field"><label>Firm name</label><input id="fName" value="${esc(f.name||'')}"></div><div class="field"><label>HMRC AML ref</label><input id="fAml" value="${esc(f.hmrcAmlRef||'')}"></div></div>
    <div class="field"><label>Address</label><input id="fAddr" value="${esc(f.address||'')}"></div>
    <div class="row"><div class="field"><label>Email</label><input id="fEmail" value="${esc(f.email||'')}"></div><div class="field"><label>Phone</label><input id="fPhone" value="${esc(f.phone||'')}"></div></div>
    <div class="row"><div class="field"><label>CMP scheme</label><select id="fCmp"><option value="">—</option>${CMP_SCHEMES.map(s=>`<option ${f.cmpScheme===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label>Property Redress</label><select id="fRedress"><option value="">—</option>${['PRS','TPOS'].map(s=>`<option ${f.redressScheme===s?'selected':''}>${s}</option>`).join('')}</select></div></div>
    <button class="btn primary" onclick="saveFirmForm()" style="margin-top:8px">Save</button>
  </div>`;
}
async function saveFirmForm(){const f=state.firm||{id:uid('firm'),ts:now()};f.name=$('#fName').value.trim();f.hmrcAmlRef=$('#fAml').value.trim();f.address=$('#fAddr').value.trim();f.email=$('#fEmail').value.trim();f.phone=$('#fPhone').value.trim();f.cmpScheme=$('#fCmp').value;f.redressScheme=$('#fRedress').value;await saveFirm(f);toast('Firm saved');render();}
// AGENTS
function renderAgents(v){
  v.innerHTML=`<div class="section-h"><h2>Agents / Negotiators</h2><div class="actions"><button class="btn primary sm" onclick="openModal('addagent')">+ Agent</button></div></div>
    ${state.agents.length?state.agents.map(a=>`<div class="card" style="max-width:620px;margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center"><div><strong>${esc(a.name)}</strong> <span style="font-family:var(--mono);font-size:10px;color:var(--cream-muted)">${esc(a.role||'negotiator')}</span></div><button class="btn sm ghost" onclick="setActiveAgent('${a.id}')">${state.ui.activeAgentId===a.id?'✓ Active':'Set active'}</button></div></div>`).join(''):'<div class="empty" style="max-width:620px"><div class="small">No agents. Add one to get started.</div></div>'}`;
}
function setActiveAgent(id){state.ui.activeAgentId=id;persistUI();toast('Active agent set');render();}
// Q&A
const T0_RULES=[
  {q:/aml|money launder|cdd/i,a:'Under MLR 2017, estate and letting agents must conduct CDD for all property transactions where rent is ≥€10,000/year or sale price is any amount. Verify identity (passport/driving licence), verify address (utility bill/bank statement), assess source of funds for buyers, screen sanctions, and check PEP status. Enhanced due diligence for high-risk clients. Report suspicious activity to NCA via SAR.'},
  {q:/right.?to.?rent|rtr|immigration/i,a:'Immigration Act 2014 requires landlords and their agents to check prospective tenants have the right to rent in the UK before granting a tenancy. Acceptable documents: UK/Irish passport, EU Settlement Scheme status, Biometric Residence Permit, or Home Office online share code. Checks must be done before tenancy starts. For time-limited right, set follow-up check before expiry. Civil penalty for non-compliance: up to £20,000 per occupier.'},
  {q:/deposit|protect|dps|tds/i,a:'Housing Act 2004 (as amended) requires tenancy deposits for ASTs in England and Wales to be protected in an authorised scheme (DPS, MyDeposits, or TDS) within 30 days of receipt. The prescribed information must be served on the tenant within 30 days. Failure to protect: tenant can claim 1-3x the deposit amount. Cannot serve a valid s.21 notice if deposit not protected.'},
  {q:/referenc|credit|afford|guarantor/i,a:'Tenant referencing typically includes: credit check (adverse credit, CCJs, insolvency), employer reference (confirming employment and salary), previous landlord reference (conduct, rent payment history), and affordability assessment (rent should typically be ≤35-40% of gross income). If affordability is marginal, a guarantor may be required — guarantor income should typically be 3x+ the annual rent.'},
  {q:/redress|complaint|prs|tpos/i,a:'All property agents in England must belong to a government-approved redress scheme: PRS (The Property Redress Scheme) or TPOS (The Property Ombudsman). Civil penalty up to £5,000 for non-membership. Agents must display membership details prominently. Complaints procedure must be in writing and provided to clients.'},
  {q:/cmp|client money|protection/i,a:'Letting agents holding client money (rent, deposits, maintenance funds) must belong to a Client Money Protection (CMP) scheme. Required under the Tenant Fees Act 2019 and Client Money Protection Schemes for Property Agents Regulations 2019. Display CMP certificate prominently. Failure: unlimited fine.'},
  {q:/fee|tenant fees act/i,a:'Tenant Fees Act 2019 (England) prohibits most fees to tenants. Permitted payments only: rent, tenancy deposit (capped at 5 weeks for rent <£50k/yr), holding deposit (capped at 1 week), early termination (capped at rent owed), and changes to tenancy requested by tenant (capped at £50). Breach: fine up to £30,000 or criminal offence for repeat.'},
  {q:/vulnerab/i,a:'While not FCA-regulated, estate and letting agents should identify vulnerable customers (elderly, disability, language barriers, financial difficulty) and make reasonable adjustments. Document vulnerability, adjustments made, and communication preferences. Consider whether additional support or time is needed for decision-making.'},
  {q:/energy|epc|mees/i,a:'Minimum Energy Efficiency Standards (MEES): rental properties must have EPC rating of E or above. Landlords cannot let a property with F or G rating unless a valid exemption is registered. EPC must be provided to prospective tenants before viewing. Valid for 10 years.'},
  {q:/sanction|pep/i,a:'Under MLR 2017, agents must screen clients against the HM Treasury sanctions list. PEP (Politically Exposed Person) status requires enhanced due diligence. Sanctions match = report to NCA immediately and do not proceed. PEP = proceed with enhanced scrutiny of source of funds and ongoing monitoring.'},
];
function askT0(q){for(const r of T0_RULES){if(r.q.test(q))return {answer:r.a,source:'T0 · estate/letting agent rules'};}return null;}
async function askT3(q){if(!state.settings.anthropicKey)return null;try{const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':state.settings.anthropicKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,messages:[{role:'user',content:'You are a UK estate and letting agent regulatory expert. Answer concisely.\n\n'+q}]})});if(!res.ok)return null;const json=await res.json();return {answer:json.content?.[0]?.text,source:'T3 · Anthropic'};}catch(e){return null;}}
function renderHelp(v){
  v.innerHTML=`<div class="section-h"><h2>Estate Agent Q & A</h2><div class="sub">T0 + T3 BYOK</div></div>
    <p style="font-size:12px;color:var(--cream-dim);margin-bottom:14px">Ask about AML CDD, Right to Rent, deposit protection, tenant referencing, redress schemes, CMP, tenant fees, vulnerability, EPC/MEES, sanctions/PEP.</p>
    <div class="card" style="max-width:780px"><div class="chat" id="chatBox">${(state.ui.chat||[]).map(m=>`<div class="msg ${m.role}">${esc(m.text)}${m.source?`<div class="src">${esc(m.source)}</div>`:''}</div>`).join('')}</div>
    <div class="chat-input"><input id="chatIn" placeholder="Ask…" onkeydown="if(event.key==='Enter')askQuestion()"><button class="btn primary" onclick="askQuestion()">Ask</button></div></div>`;
  const box=$('#chatBox');if(box)box.scrollTop=box.scrollHeight;
}
async function askQuestion(){const inp=$('#chatIn');if(!inp)return;const q=inp.value.trim();if(!q)return;inp.value='';if(!state.ui.chat)state.ui.chat=[];state.ui.chat.push({role:'user',text:q});render();let r=askT0(q);if(!r)r=await askT3(q);state.ui.chat.push(r?{role:'bot',text:r.answer,source:r.source}:{role:'bot',text:'No T0 match. Add a BYOK key in Settings for T3.',source:'system'});persistUI();render();}
// MODALS
function openModal(type){
  const root=$('#modalRoot');
  if(type==='settings'){root.innerHTML=`<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-h"><h3>Settings</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
    <div class="field"><label>Brand name</label><input id="sBrand" value="${esc(state.brandName)}"></div>
    <div class="field"><label>Anthropic key (T3)</label><input id="sAnthro" type="password" value="${esc(state.settings.anthropicKey||'')}"></div>
    <div style="margin:10px 0"><label style="font-size:12px"><input type="checkbox" id="sAudit" ${state.settings.auditChain?'checked':''}> Audit chain</label></div>
    <div class="divider"></div>
    <div style="display:flex;gap:8px"><button class="btn ghost sm" onclick="exportState()">Export</button><button class="btn ghost sm" onclick="importState()">Import</button><button class="btn danger sm" onclick="wipeState()">Wipe</button></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn primary" onclick="saveSettingsModal()">Save</button><button class="btn ghost" onclick="closeModal()">Cancel</button></div>
  </div></div></div>`;}
  else if(type==='addagent'){root.innerHTML=`<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-h"><h3>Add Agent</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
    <div class="row"><div class="field"><label>Name</label><input id="aaName"></div><div class="field"><label>Role</label><input id="aaRole" value="negotiator"></div></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn primary" onclick="saveNewAgent()">Add</button><button class="btn ghost" onclick="closeModal()">Cancel</button></div>
  </div></div></div>`;}
  else if(type==='audit'){const entries=state.audit.slice().reverse().slice(0,100);root.innerHTML=`<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:900px"><div class="modal-h"><h3>Audit · ${state.audit.length} entries</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">${entries.map(e=>`<div class="audit-entry"><span class="a-action">${esc(e.action)}</span> <span class="a-meta">${dateTime(e.ts)}</span>${e.reasoning?`<div class="a-reason">${esc(e.reasoning)}</div>`:''}</div>`).join('')}</div></div></div>`;}
}
function closeModal(){$('#modalRoot').innerHTML='';}
async function saveNewAgent(){const a={id:uid('agt'),firmId:state.firm?state.firm.id:'',ts:now(),updatedAt:now(),name:$('#aaName').value.trim(),role:$('#aaRole').value.trim()};if(!a.name){toast('Name required');return;}await saveAgent(a);if(!state.ui.activeAgentId)state.ui.activeAgentId=a.id;closeModal();toast('Agent added');render();}
function saveSettingsModal(){state.brandName=$('#sBrand').value.trim()||'FallEstateOnboard';state.settings.anthropicKey=$('#sAnthro').value.trim();state.settings.auditChain=$('#sAudit').checked;$('#tierBadge').textContent=state.settings.anthropicKey?'T3':'T0';persistUI();closeModal();toast('Settings saved');render();}
function exportState(){const d={tool:TOOLNAME,v:VERSION,ts:now(),firm:state.firm,agents:state.agents,clients:state.clients};const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='fallestateonboard-export.json';a.click();URL.revokeObjectURL(u);toast('Exported');}
function importState(){const inp=document.createElement('input');inp.type='file';inp.accept='.json';inp.onchange=async()=>{const f=inp.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(d.firm){state.firm=d.firm;await idbPut('firms',d.firm);}for(const k of['agents','clients']){if(Array.isArray(d[k]))for(const r of d[k]){state[k].push(r);await idbPut(k,r);}}persistUI();toast('Imported');render();}catch(e){toast('Failed');}};inp.click();}
async function wipeState(){if(!confirm('Wipe ALL data?'))return;if(!confirm('Sure?'))return;for(const s of['firms','agents','clients','audit','documents','state']){const tx=db.transaction(s,'readwrite');tx.objectStore(s).clear();await new Promise(r=>{tx.oncomplete=r;});}location.reload();}
// DEMO
async function seedDemoIfEmpty(){
  if(state.clients.length||state.agents.length||state.firm)return;
  const firmId=uid('firm');
  const firm={id:firmId,name:'Demo Estates & Lettings',hmrcAmlRef:'XMLR00012345',address:'5 High Street, London SW1A 2AA',email:'info@demoestates.co.uk',phone:'020 7456 7890',cmpScheme:'DPS',redressScheme:'PRS',updatedAt:now(),isDemo:true};
  state.firm=firm;await idbPut('firms',firm);
  const agt={id:uid('agt'),firmId,name:'Demo Negotiator',role:'senior negotiator',updatedAt:now(),isDemo:true};
  state.agents.push(agt);state.ui.activeAgentId=agt.id;await idbPut('agents',agt);
  const t=newClientRec();t.isDemo=true;t.clientType='tenant';t.title='Ms';t.firstName='Emma';t.lastName='Clarke';t.dob='1994-06-12';t.nationality='GB';t.phone='07700 900789';t.email='emma.clarke@email.co.uk';t.address='18 Oak Road, London';t.postcode='SE1 4QR';t.employer='TechCorp Ltd';t.annualIncome=38000;t.propertyAddress='Flat 3, 22 Elm Street, London';t.propertyPostcode='SE1 5AB';t.rent=1400;t.tenancyStart='2026-07-01';t.tenancyType='AST';t.status='in-progress';
  t.aml={idVerified:true,addressVerified:true,sourceOfFunds:'employment',sanctionsChecked:true,pepStatus:false,riskGrade:'low',riskReasons:[],cddComplete:true,notes:''};
  t.rtr={checked:true,documentType:'UK/Irish passport',shareCode:'',rightConfirmed:true,restrictedUntil:'',followUpDate:'',notes:''};
  t.referencing={creditCheck:true,employerRef:true,landlordRef:false,affordabilityCheck:true,guarantorRequired:false,guarantorName:'',guarantorRelationship:'',guarantorIncome:0,notes:''};
  t.deposit={amount:1615,scheme:'DPS',schemeRef:'DPS-2026-789012',protectedDate:'2026-07-02'};
  state.clients.push(t);await idbPut('clients',t);
  const b=newClientRec();b.isDemo=true;b.clientType='buyer';b.title='Mr';b.firstName='Richard';b.lastName='Osei';b.dob='1985-11-03';b.nationality='GB';b.phone='07700 900456';b.email='r.osei@email.co.uk';b.address='12 Maple Ave, London';b.postcode='N1 2XY';b.annualIncome=75000;b.status='new';
  b.aml={idVerified:true,addressVerified:false,sourceOfFunds:'savings',sanctionsChecked:false,pepStatus:false,riskGrade:'medium',riskReasons:['sanctions unchecked'],cddComplete:false,notes:''};
  state.clients.push(b);await idbPut('clients',b);
  await auditLog('demo.seeded',{reasoning:'first boot'});await persistUI();
}
// BOOT
(async function boot(){
  try{await openDB();await loadAll();await seedDemoIfEmpty();initMesh();$('#tierBadge').textContent=state.settings.anthropicKey?'T3':'T0';render();
})();

// Named exports for the primary API surface
export { loadConfig };
export { saveConfig };
export { $ };
export { esc };
export { aiTier };
export { renderAiChip };
export { loadWebLLM };
export { aiComplete };
export { aiCloudCall };
export { meshStart };

export { FALL_KIT_VERSION };
export { KCC_MINT_URL };
export { WEBLLM_MODELS };
export { DEFAULT_MODEL };
export { T3_PROVIDERS };
export { STATE };
export { MESH_CHANNEL };
export { STUN_SERVERS };
export { TOOLNAME };
export { TABS };
