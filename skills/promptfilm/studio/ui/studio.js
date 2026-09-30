'use strict';
/* Promptfilm Studio — the page. The film plays in a same-origin iframe and is driven through its window.__bw hooks: seek(t) draws
   one frame, and the Studio calls it on every animation frame while playing (external drawing), so any rate works, scrubbing is
   exact, and what you see at t is what the MP4 shows at t. */

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem('pf.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pf.' + k, JSON.stringify(v)); } catch (e) {} },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const encPath = p => p.split('/').map(encodeURIComponent).join('/');
const fmtT = t => { if (!isFinite(t)) return '–'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };
const fmtDur = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`; };
const fmtBytes = n => n > 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';
const base = p => p.split('/').pop();

/* ---------- words ---------- */
const I18N = {
  ko: {
    film: '영상', version: '버전', latest: '최신', shortcuts: '단축키 · 언어',
    loading: '영상을 불러오는 중…', filmError: '영상을 열 수 없어요', filmTimeout: '영상이 시작되지 않았어요 (네트워크나 GPU를 확인해 주세요)',
    empty: '아직 영상이 없어요.<br>Claude Code에 모션그래픽을 만들어 달라고 하면(<b>promptfilm</b>) 여기에 나타나요.<br><br>찾는 위치: <code>{root}</code>',
    offline: '스튜디오 서버와 연결이 끊겼어요 · 다시 연결하는 중', opened: 'Claude가 이 영상을 열었어요', newFilm: '새 영상이 생겨서 열었어요 — {f}',
    stepBack: '한 프레임 뒤로 (←)', stepFwd: '한 프레임 앞으로 (→)', playPause: '재생 / 일시정지 (Space)', rate: '재생 속도',
    comment: '코멘트', commentKey: '코멘트 모드 (C) — 화면을 클릭해 그 자리에 코멘트를 남겨요', commentHint: '코멘트 모드 — 고칠 곳을 클릭하세요 · C로 끄기',
    lane_beats: '구간', lane_caps: '자막', lane_pins: '코멘트',
    kind_hook: '도입', kind_key: '핵심', kind_normal: '보통', kind_transit: '이동', kind_return: '복귀',
    review: '리뷰', reviewCount: '열린 {o} / {a}', doneHead: '반영됨 {n}', addGeneral: '+ 화면 전체 코멘트',
    copied: '복사했어요 — Claude Code에 붙여넣으면 코멘트를 반영해요', copyText: 'promptfilm 리뷰 반영해줘: {dir} — 열린 코멘트 {n}개 ({file})',
    noOpen: '열린 코멘트가 없어요. 모두 반영됐어요.', noPins: '아직 코멘트가 없어요.<br>이상한 장면에서 멈추고 <b>C</b>를 누른 뒤 고칠 곳을 클릭하세요.',
    pinPlaceholder: '무엇이 문제인지 적어 주세요 (예: 이 별이 갑자기 튀어나와요)', enterSave: 'Enter 저장 · Shift+Enter 줄바꿈',
    save: '저장', cancel: '취소', edit: '수정', del: '삭제', delSure: '정말 삭제?', reopen: '다시 열기', snapping: '스냅샷 만드는 중…', whole: '화면 전체',
    saved: '코멘트를 남겼어요 — Claude가 볼 스냅샷을 만드는 중이에요',
    render: '내보내기', final: '최종 · 60fps', draft: '미리보기 · 30fps (빠름)', withText: '자막·라벨 포함', startRender: 'MP4 만들기', cancelRender: '취소',
    gateOk: '이 빌드는 전체 검사와 화면 검수를 통과했어요', gateNo: '이 빌드는 아직 검사를 통과하지 않았어요', gate_qaNone: '자동 검사 전', gate_qaOld: '검사 후 영상이 바뀜', gate_qaPartial: '일부만 검사함', gate_qaFail: '자동 검사 실패: {x}', gate_reviewNone: '화면 검수 전', gate_reviewOld: '검수 후 영상이 바뀜', gate_reviewFail: '화면 검수에서 문제 발견', chk_pace: '속도', chk_read: '캡션·멈춤', chk_empty: '빈 화면', chk_surfaces: '모델 구멍·통과', chk_engine: '엔진 버전', chk_flicker: '깜빡임',
    still: 'PNG', stillHint: '지금 화면을 PNG로 저장해요 (썸네일용)', stillBusy: '…', stillSaved: 'PNG를 저장했어요',
    rendering: '만드는 중', left: '남음', renderDone: 'MP4 완성 — {s}초 영상, {e}초 걸림', renderErr: 'MP4를 만들지 못했어요: {e}', renderCancelled: 'MP4 만들기를 취소했어요',
    otherFilm: '다른 영상({f})을 만드는 중이에요', open: '열기', reveal: 'Finder', noRenders: '아직 만든 파일이 없어요.',
    reloaded: '새 빌드를 불러왔어요 ({t})', target: '목표 {r}초',
    h_space: '재생 / 일시정지', h_arrows: '한 프레임 이동', h_sarrows: '1초 이동', h_home: '처음 / 끝', h_c: '코멘트 모드', h_t: '자막·라벨 숨기기 / 보이기',
    h_s: '안전 영역 (플랫폼 UI가 가리는 곳)', h_zoom: '타임라인 확대 / 축소 / 맞춤', h_undo: '속도 편집 되돌리기', h_esc: '닫기', h_lang: '언어',
    textOff: '자막·라벨을 숨겼어요 — T로 다시 보여요', textOn: '자막·라벨이 다시 보여요', safeOn: '안전 영역을 표시했어요 — S로 꺼요', safeOff: '안전 영역을 껐어요',
    oldFilm: '예전 엔진으로 만든 영상이라 구간 정보가 없어요. 재생, 코멘트, 내보내기는 그대로 돼요.',
    tabFilm: '영상', tabBoard: '스토리보드', boardOnly: '스토리보드만', noBuildYet: '아직 빌드가 없어요 — 스토리보드를 먼저 확인해 주세요.',
    sbVersion: '버전 {v}', sbEstimate: '예상 {e}초', sbTarget: '목표 {r}초', sbCamera: '카메라', sbIll: '공개 자료가 없어 그려서 보여줘요: {t}',
    sbOk: '좋아요', sbChange: '고쳐 주세요', sbNotePh: '무엇을 어떻게 바꾸면 좋을지 적어 주세요', sbChanged: '수정됨',
    sbReply: 'CLAUDE · 버전 {v}', sbQuestions: 'Claude의 질문', sbAnswerPh: '답을 적어 주세요', sbNotePhAll: '전체에 대한 한마디 (선택)',
    sbApprove: '이대로 제작 시작', sbRevise: '수정본 다시 볼게요', sbApproveFix: '고쳐서 바로 제작', sbSentAt: '{t}에 보냈어요',
    sbSent: 'Claude에게 보냈어요 — {what}', sbWhatApprove: '제작을 시작해요', sbWhatRevise: '수정본을 만들어요', sbNewVersion: '스토리보드가 버전 {v}로 바뀌었어요',
    sbCopy: 'promptfilm 스토리보드 {what}: {dir} — 수정 {n}개 ({file})', sbCopyApprove: '승인', sbCopyRevise: '수정 요청', sbEmpty: '스토리보드가 비어 있어요.',
    firstBuild: '첫 빌드가 나왔어요 — 영상으로 넘어갈게요', sbCounts: '좋아요 {ok} · 수정 {ch} · 미확인 {no}',
    sbScenes: '장면 {n}개', sbSec: '{s}초', sbMore: '자세히', sbCaption: '자막 원문', sbFactsHead: '근거', sbIllShort: '일러스트', sbSumMore: '클릭하면 전체를 봐요',
    srcBuild: '현재 빌드 · {t}', srcLook: '실제 렌더', srcRef: '참고 사진', srcNone: '렌더 전 · 빌드되면 실제 화면이 나와요',
    srcMaking: '실제 화면을 만드는 중…', srcNotYet: '이 장면은 아직 빌드 전이에요', playHere: '이 장면부터 재생', sbFramesMaking: '장면마다 실제 화면을 렌더하는 중… {n}/{m}',
    sbLocked: '✓ {t}에 승인한 스토리보드예요. 고칠 점은 영상 탭에서 화면에 코멘트로 남겨 주세요.',
    sbWorking: 'Claude 작업 중', alreadyWorking: '이미 Claude에게 전달돼서 작업 중이에요 — 끝나면 스튜디오가 알려 줘요',
    paceBar: '속도 편집 {n}개 · 원래 {o}초', paceUndo: '되돌리기', paceReset: '모두 원래대로',
    paceSaved: '속도를 저장했어요 · {name}', paceSavedMany: '속도를 저장했어요', paceErr: '속도를 저장하지 못했어요: {e}',
    paceNoEngine: '이 영상의 엔진은 속도 편집을 지원하지 않아요 (Claude에게 엔진 업데이트를 요청하세요)', paceNoFile: '예전 버전을 보는 중이라 속도는 최신 버전에서만 고칠 수 있어요',
    bp_dur: '{d}초 동안 재생', bp_was: '(원래 {d}초)', bp_slower: '더 느리게', bp_faster: '더 빠르게', bp_reset: '원래대로', bp_close: '닫기',
    dragHint: '오른쪽 끝을 끌면 속도가 바뀌어요 · 클릭하면 편집',
    cl_on: 'Claude 연결됨', cl_busy: 'Claude 작업 중 · {m}', cl_off: 'Claude 대기 없음', cl_offTip: 'Claude Code에서 promptfilm 작업을 하고 있으면 자동으로 연결돼요. 연결이 없을 땐 문장을 복사해 붙여 넣어 주세요.',
    sendClaude: 'Claude에게 보내기', copyInstead: '문장 복사하기', sent: 'Claude에게 보냈어요 — 코멘트 {n}개를 반영하기 시작해요', notListening: 'Claude Code 세션이 연결돼 있지 않아서 문장을 복사했어요 — 붙여 넣어 주세요',
  },
  en: {
    film: 'Film', version: 'Version', latest: 'latest', shortcuts: 'Shortcuts · language',
    loading: 'Loading the film…', filmError: 'The film could not start', filmTimeout: 'The film did not start (check the network or the GPU)',
    empty: 'No films yet.<br>Ask Claude Code for a motion graphic (<b>promptfilm</b>) and it appears here.<br><br>Looking in: <code>{root}</code>',
    offline: 'Lost the Studio server · reconnecting', opened: 'Claude opened this film', newFilm: 'A new film appeared — opened {f}',
    stepBack: 'Back one frame (←)', stepFwd: 'Forward one frame (→)', playPause: 'Play / pause (Space)', rate: 'Playback rate',
    comment: 'Comment', commentKey: 'Comment mode (C) — click the frame to pin a comment there', commentHint: 'Comment mode — click what needs fixing · C to leave',
    lane_beats: 'Beats', lane_caps: 'Captions', lane_pins: 'Comments',
    kind_hook: 'hook', kind_key: 'key', kind_normal: 'normal', kind_transit: 'transit', kind_return: 'return',
    review: 'Review', reviewCount: '{o} open / {a}', doneHead: '{n} addressed', addGeneral: '+ Comment on the whole frame',
    copied: 'Copied — paste it into Claude Code to apply the comments', copyText: 'promptfilm: apply the review for {dir} — {n} open comments ({file})',
    noOpen: 'No open comments — everything has been addressed.', noPins: 'No comments yet.<br>Pause where something looks wrong, press <b>C</b> and click the spot.',
    pinPlaceholder: 'What is wrong here? (e.g. this star pops in)', enterSave: 'Enter to save · Shift+Enter for a new line',
    save: 'Save', cancel: 'Cancel', edit: 'Edit', del: 'Delete', delSure: 'Delete?', reopen: 'Reopen', snapping: 'making the snapshot…', whole: 'whole frame',
    saved: 'Comment pinned — making a snapshot for Claude',
    render: 'Export', final: 'Final · 60 fps', draft: 'Preview · 30 fps (fast)', withText: 'Captions and labels', startRender: 'Make the MP4', cancelRender: 'Cancel',
    gateOk: 'This build passed the full checks and the visual review', gateNo: 'This build has not passed its checks yet', gate_qaNone: 'not checked yet', gate_qaOld: 'changed since the checks', gate_qaPartial: 'only partly checked', gate_qaFail: 'checks fail: {x}', gate_reviewNone: 'no visual review yet', gate_reviewOld: 'changed since the review', gate_reviewFail: 'the visual review found problems', chk_pace: 'pace', chk_read: 'captions and stops', chk_empty: 'empty frames', chk_surfaces: 'holes and pass-throughs', chk_engine: 'engine version', chk_flicker: 'flicker',
    still: 'PNG', stillHint: 'Save this frame as a PNG (for a thumbnail)', stillBusy: '…', stillSaved: 'PNG saved',
    rendering: 'Making', left: 'left', renderDone: 'MP4 ready — a {s} s video in {e} s', renderErr: 'Could not make the MP4: {e}', renderCancelled: 'MP4 cancelled',
    otherFilm: 'Making another film ({f})', open: 'Open', reveal: 'Show', noRenders: 'Nothing exported yet.',
    reloaded: 'New build loaded ({t})', target: 'target {r} s',
    h_space: 'Play / pause', h_arrows: 'One frame', h_sarrows: 'One second', h_home: 'Start / end', h_c: 'Comment mode', h_t: 'Hide / show captions and labels',
    h_s: "Safe zones (where the platform's UI covers)", h_zoom: 'Timeline zoom in / out / fit', h_undo: 'Undo a pace edit', h_esc: 'Close', h_lang: 'Language',
    textOff: 'Captions and labels hidden — T shows them', textOn: 'Captions and labels shown', safeOn: 'Safe zones shown — S hides them', safeOff: 'Safe zones hidden',
    oldFilm: 'Made with an older engine: no beats to show. Playing, comments and export all work.',
    tabFilm: 'Film', tabBoard: 'Storyboard', boardOnly: 'storyboard only', noBuildYet: 'No build yet — look at the storyboard first.',
    sbVersion: 'version {v}', sbEstimate: 'about {e} s', sbTarget: 'target {r} s', sbCamera: 'Camera', sbIll: 'Drawn without a public source: {t}',
    sbOk: 'Looks good', sbChange: 'Change this', sbNotePh: 'What should change, and how?', sbChanged: 'changed',
    sbReply: 'CLAUDE · version {v}', sbQuestions: "Claude's questions", sbAnswerPh: 'Your answer', sbNotePhAll: 'A note on the whole film (optional)',
    sbApprove: 'Start production as it is', sbRevise: 'Show me a revised version', sbApproveFix: 'Fix these and start', sbSentAt: 'sent at {t}',
    sbSent: 'Sent to Claude — {what}', sbWhatApprove: 'production starts', sbWhatRevise: 'a revised version is coming', sbNewVersion: 'The storyboard is now version {v}',
    sbCopy: 'promptfilm storyboard {what}: {dir} — {n} changes ({file})', sbCopyApprove: 'approved', sbCopyRevise: 'change requests', sbEmpty: 'The storyboard is empty.',
    firstBuild: 'The first build is here — switching to the film', sbCounts: 'good {ok} · change {ch} · unmarked {no}',
    sbScenes: '{n} scenes', sbSec: '{s} s', sbMore: 'Details', sbCaption: 'Caption', sbFactsHead: 'Facts', sbIllShort: 'illustrative', sbSumMore: 'Click to read it all',
    srcBuild: 'Current build · {t}', srcLook: 'Rendered', srcRef: 'Reference photo', srcNone: 'Not rendered yet · the film shows here once built',
    srcMaking: 'Rendering the film\'s frame…', srcNotYet: 'This scene isn\'t built yet', playHere: 'Play from this scene', sbFramesMaking: 'Rendering each scene from the film… {n}/{m}',
    sbLocked: '✓ Approved at {t}. For changes, pin comments on the film (Film tab).',
    sbWorking: 'Claude working', alreadyWorking: 'Already sent — Claude is working on it; the Studio shows when it is done',
    paceBar: '{n} pace edits · was {o} s', paceUndo: 'Undo', paceReset: 'Reset all',
    paceSaved: 'Pace saved · {name}', paceSavedMany: 'Pace saved', paceErr: 'Could not save the pace: {e}',
    paceNoEngine: "This film's engine can't edit pace (ask Claude to update its engine)", paceNoFile: 'An older version is open: pace is edited on the latest one',
    bp_dur: 'plays {d} s', bp_was: '(was {d} s)', bp_slower: 'Slower', bp_faster: 'Faster', bp_reset: 'Reset', bp_close: 'Close',
    dragHint: 'Drag the right edge to change the speed · click to edit',
    cl_on: 'Claude connected', cl_busy: 'Claude working · {m}', cl_off: 'No Claude session', cl_offTip: 'A Claude Code session working on promptfilm connects by itself. Without one, copy the sentence and paste it.',
    sendClaude: 'Send to Claude', copyInstead: 'Copy the sentence', sent: 'Sent to Claude — it starts on {n} comments', notListening: 'No Claude Code session is connected, so the sentence was copied — paste it there',
  },
};
let LANG = store.get('lang', (navigator.language || 'en').toLowerCase().startsWith('ko') ? 'ko' : 'en');
const tr = (k, vars) => { let s = I18N[LANG][k] ?? I18N.en[k] ?? k; if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(b); return s; };
function applyI18n() {
  document.documentElement.lang = LANG;
  $$('[data-t]').forEach(el => { el.textContent = tr(el.dataset.t); });
  $$('[data-title]').forEach(el => { el.title = tr(el.dataset.title); });
  $('#pop-text').placeholder = tr('pinPlaceholder');
}

/* ---------- state ---------- */
const FPS = 60;
const SAFE_DEFAULT = { top: 0.07, bottom: 0.20, side: [0.85, 0.45, 0.80] };
const OUT = { '9x16': '1080 × 1920', '16x9': '1920 × 1080', '1x1': '1080 × 1080', '4x5': '1080 × 1350' };
const KIND_COLOR = { hook: 'var(--hook)', key: 'var(--key)', normal: 'var(--normal)', transit: 'var(--transit)', return: 'var(--return)' };
const S = {
  films: [], film: null, file: null, rootName: '',
  win: null, bw: null, ready: false, loop: 0, ar: 9 / 16,
  data: { beats: [], caps: [], format: null, safe: SAFE_DEFAULT },
  t: 0, playing: false, rate: 1, last: 0, resume: false,
  zoom: 1, pps: 1, commenting: false, textOn: true, safeOn: false,
  review: { pins: [] }, sel: null, draft: null, job: null, es: null, ui: null,
  pace: { supported: false, why: '', edits: {}, saved: {} }, paceUndo: [], base: null, freezePps: 0, expectSaveUntil: 0,
  claude: { listening: 0, active: null }, view: 'film', viewFor: {}, sb: null, sbf: { stamp: null, frames: {} },
  quality: store.get('quality', 'final'), rtext: store.get('rtext', true),
};

async function api(path, opts = {}) {
  const r = await fetch(path, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
function toast(html, kind = '', ms = 3800) {
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.innerHTML = html; $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, ms);
}
const hash = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
let hashTimer = 0;
function saveHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => { if (!S.film) return; const h = new URLSearchParams({ film: S.film.id, t: S.t.toFixed(2) }); if (S.file !== S.film.html) h.set('file', S.file); history.replaceState(null, '', '#' + h); }, 300);
}

/* ---------- films ---------- */
let filmsAt = 0, emptyTimer = 0, knownFilms = null;
async function loadFilms(keep, want) {
  filmsAt = Date.now();
  let r; try { r = await api('/api/films'); } catch (e) { return; }
  S.films = r.films; S.rootName = r.root;
  // a film that wasn't here before (Claude just started one): show it, unless the requester is in the middle of something
  const fresh = knownFilms ? S.films.find(f => !knownFilms.has(f.id)) : null; knownFilms = new Set(S.films.map(f => f.id));
  if (fresh && !want && keep && !busy()) { want = fresh.id; toast(esc(tr('newFilm', { f: fresh.name })), 'ok', 6000); }
  if (r.job) onRender(r.job, true);
  clearTimeout(emptyTimer);
  if (!S.films.length) { showEmpty(); emptyTimer = setTimeout(() => { if (!document.hidden) loadFilms(); }, 8000); return; }
  $('#empty').hidden = true; $('#stage').hidden = false;
  if (want && S.films.some(f => f.id === want) && !(S.film && S.film.id === want)) return selectFilm(want);
  if (keep && S.film && S.films.some(f => f.id === S.film.id)) { S.film = S.films.find(f => f.id === S.film.id); fillSelects(); renderRenderList(); return; }
  const h = hash(), pick = want || h.film, f = S.films.find(x => x.id === pick) || S.films[0];   // S.films[0]: the film worked on last
  selectFilm(f.id, f.id === h.film ? h.file : null, f.id === h.film ? +h.t || 0 : 0);
  if (f.id === h.film && (h.view === 'board' || h.view === 'film')) setView(h.view);
}
function showEmpty() {
  $('#stage').hidden = true; const e = $('#empty'); e.hidden = false; e.innerHTML = tr('empty', { root: esc(S.rootName) });
  S.film = null; fillSelects(); if (!S.es) connectEvents();
}
function fillSelects() {
  const fs = $('#film-select');
  fs.innerHTML = S.films.map(f => `<option value="${esc(f.id)}"${S.film && f.id === S.film.id ? ' selected' : ''}>${esc(f.name)}${f.dir !== '.' && f.dir !== f.name ? ' — ' + esc(f.dir) : ''}${f.html ? '' : ' · ' + esc(tr('boardOnly'))}${f.openPins ? ' · ●' + f.openPins : ''}</option>`).join('');
  fs.hidden = !S.films.length;
  const vs = $('#version-select');
  vs.hidden = !(S.film && S.film.html && S.film.versions.length);            // only when there is an earlier version to compare
  if (!S.film) { vs.innerHTML = ''; return; }
  vs.innerHTML = [S.film.html, ...S.film.versions].filter(Boolean).map(v => `<option value="${esc(v)}"${v === S.file ? ' selected' : ''}>${v === S.film.html ? tr('latest') + ' · ' : ''}${esc(base(v))}</option>`).join('');
}
const busy = () => !$('#pop').hidden || S.playing || S.commenting || !!(document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName));
function selectFilm(id, file, t = 0) {
  S.film = S.films.find(f => f.id === id); S.ready = false;
  S.file = file && (file === S.film.html || S.film.versions.includes(file)) ? file : S.film.html;
  S.t = t; setPlaying(false); S.sel = null; S.review = { pins: [] };
  S.pace = { supported: false, why: '', edits: {}, saved: {} }; S.paceUndo = []; S.base = null; closeBeatPop();
  fillSelects(); renderTotal(); renderReview(); renderRenderList(); renderPaceBar();
  $('#render-job').hidden = !(S.job && (S.job.status === 'running' || S.job.film === id)); if (S.job) onRender(S.job, true);
  connectEvents(); loadReview();
  S.sb = null; S.sbf = { stamp: null, frames: {} }; renderTabs(); loadStoryboard();
  setView(!S.film.html ? 'board' : (S.viewFor[id] || (S.film.sbTime && !S.film.sbApproved ? 'board' : 'film')));
  if (S.film.html) loadFrame(); else { $('#film').removeAttribute('src'); stageMsg(esc(tr('noBuildYet'))); }
}
function setView(v) {
  if (v === 'film' && !(S.film && S.film.html)) v = 'board';
  S.view = v; if (S.film) S.viewFor[S.film.id] = v;
  const board = v === 'board';
  $('#board').hidden = !board; $('#viewer').hidden = board; $('#timeline').hidden = board;
  $('#side').hidden = board; $('#app').classList.toggle('boarding', board);     // the storyboard has the whole width: no review or export yet
  if (board) { setPlaying(false); renderBoard(); loadSbFrames(); }
  renderTabs();
}
function renderTabs() {
  const tabs = $('#view-tabs'); tabs.hidden = !S.sb;
  $$('#view-tabs button').forEach(b => { b.classList.toggle('on', b.dataset.v === S.view); b.disabled = b.dataset.v === 'film' && !(S.film && S.film.html); });
}

/* ---------- the film in the iframe ---------- */
let loadSeq = 0;
function stageMsg(html, err) { const m = $('#stage-msg'); m.hidden = false; m.classList.toggle('err', !!err); m.innerHTML = `<div>${html}</div>`; }
const ASPECTS = { '9x16': 9 / 16, '16x9': 16 / 9, '1x1': 1, '4x5': 0.8 };
const snapAspect = ar => Object.keys(ASPECTS).sort((a, b) => Math.abs(Math.log(ar / ASPECTS[a])) - Math.abs(Math.log(ar / ASPECTS[b])))[0];
function loadFrame() {
  const seq = ++loadSeq; S.ready = false; S.bw = null; S.win = null;
  S.ar = ASPECTS[S.film.aspect] || 9 / 16; layoutStage();      // the film starts at its final size (no resize after it loads)
  S.frameSize = [$('#stage').clientWidth, $('#stage').clientHeight];
  stageMsg(`<div class="spin"></div>${esc(tr('loading'))}`);
  const fr = $('#film');
  fr.onload = () => waitStarted(seq);
  fr.src = `/f/${encPath(S.file)}?freeze&studio=1&_=${Date.now()}`;
}
async function waitStarted(seq) {
  const t0 = performance.now();
  while (seq === loadSeq) {
    let w, err;
    try { w = $('#film').contentWindow; err = w.document.getElementById('err'); } catch (e) { return; }
    if (err && !err.hidden) { stageMsg(`<b>${esc(tr('filmError'))}</b><br><small>${esc(err.textContent.trim())}</small>`, true); return; }
    if (w.__started && w.__bw && w.__bw.LOOP) return onFilmReady(w);
    if (performance.now() - t0 > 120000) { stageMsg(esc(tr('filmTimeout')), true); return; }
    await sleep(80);
  }
}
function onFilmReady(w) {
  S.win = w; S.bw = w.__bw;
  // the film draws only when the Studio asks (seek draws a frame): external drawing on, and the film's own loop held — films whose
  // engine is older than the resting loop keep ticking every frame (or, before external drawing, redraw the same frame) while paused
  try { if (typeof S.bw.external === 'function') S.bw.external(true); if (/render/i.test(String(S.bw.seek))) w.requestAnimationFrame = () => 0; } catch (e) {}
  readFilmData(); S.ready = true;
  layoutStage(); buildTimeline(); applyText(); renderSafe(); renderTotal(); renderPins();
  loadPace();
  $('#stage-msg').hidden = true;
  seek(Math.min(S.t, S.loop - 1e-3));
  setTimeout(redraw, 80);                                    // after the iframe's own resize handler
  if (S.resume) { S.resume = false; setPlaying(true); }
}
function readFilmData() {
  const b = S.bw, D = S.data;
  const call = f => { try { return typeof b[f] === 'function' ? b[f]() : null; } catch (e) { return null; } };
  S.loop = b.LOOP;
  let aspect = b.FORMAT && b.FORMAT.aspect;
  if (!aspect) { try { const f = S.win.document.getElementById('frame'), r = f.getBoundingClientRect(); aspect = snapAspect(r.width / r.height); } catch (e) { aspect = S.film.aspect || '9x16'; } }
  D.format = b.FORMAT || { aspect, langs: null, length: null };
  D.safe = b.SAFE || SAFE_DEFAULT;
  D.beats = call('beats') || [];
  D.caps = call('captions') || [];
  const [aw, ah] = String(D.format.aspect || '9x16').split('x').map(Number); S.ar = aw / ah || 9 / 16;
}
const redraw = () => { if (S.ready) try { S.bw.seek(S.t); } catch (e) {} };
function layoutStage() {
  const v = $('#viewer'), pad = 18, aw = v.clientWidth - pad * 2, ah = v.clientHeight - pad * 2;
  if (aw < 40 || ah < 40) return;
  let h = ah, w = h * S.ar; if (w > aw) { w = aw; h = w / S.ar; }
  const st = $('#stage'), W = Math.floor(w), H = Math.floor(h), fr = $('#film');
  st.style.width = W + 'px'; st.style.height = H + 'px';
  // films made before external drawing existed don't survive a resize (their render targets keep the old size): their page keeps
  // the size it started at and the picture is scaled instead
  if (S.ready && S.bw && typeof S.bw.external !== 'function' && S.frameSize) {
    fr.style.width = S.frameSize[0] + 'px'; fr.style.height = S.frameSize[1] + 'px'; fr.style.transformOrigin = '0 0'; fr.style.transform = `scale(${W / S.frameSize[0]})`;
  } else { fr.style.width = ''; fr.style.height = ''; fr.style.transform = ''; if (!S.ready) S.frameSize = [W, H]; }
  renderPins();
}
function applyText() { try { S.win.document.getElementById('frame').classList.toggle('nolabels', !S.textOn); } catch (e) {} }
function renderSafe() {
  const L = $('#safe-layer'), z = S.data.safe; L.hidden = !S.safeOn;
  if (!S.safeOn) return;
  const box = (css, label) => `<div style="${css}">${label ? `<span>${esc(label)}</span>` : ''}</div>`;
  L.innerHTML = box(`left:0;right:0;top:0;height:${z.top * 100}%`) + box(`left:0;right:0;bottom:0;height:${z.bottom * 100}%`) +
    (z.side ? box(`right:0;width:${(1 - z.side[0]) * 100}%;top:${z.side[1] * 100}%;bottom:${(1 - z.side[2]) * 100}%`) : '');
}

/* ---------- time ---------- */
function seek(t) {
  if (!S.loop) return;
  S.t = ((t % S.loop) + S.loop) % S.loop;
  redraw(); updateNow(); saveHash();
}
let rafId = 0;                                               // the Studio draws only while playing: no loop at all while paused
function setPlaying(on) {
  S.playing = !!on && S.ready; S.last = 0;
  document.body.classList.toggle('playing', S.playing);
  if (S.playing && !rafId) rafId = requestAnimationFrame(tick);
  if (!S.playing) saveHash();
}
function step(frames) { setPlaying(false); seek(Math.round(S.t * FPS + frames) / FPS); }
function tick(now) {
  rafId = 0;
  if (!S.playing || !S.ready) return;
  const dt = S.last ? Math.min(0.1, (now - S.last) / 1000) : 0;
  S.t = (S.t + dt * S.rate) % S.loop; S.last = now;
  redraw(); updateNow();
  rafId = requestAnimationFrame(tick);
}
function renderTotal() {                                     // the loop's length, flagged when it is outside the target length
  const F = S.data.format, el = $('#t-total'), out = S.ready && F && F.length && (S.loop < F.length[0] - 0.5 || S.loop > F.length[1] + 0.5);
  el.textContent = fmtT(S.loop); el.classList.toggle('warn', !!out); el.title = S.ready && F && F.length ? tr('target', { r: F.length.join('–') }) : '';
  $('#render-size').textContent = F ? (OUT[F.aspect] || '') : '';
}
function updateNow() {
  $('#t-now').textContent = fmtT(S.t);
  const x = tx(S.t); $('#tl-head').style.transform = `translateX(${x}px)`;
  if (S.playing) { const sc = $('#tl-scroll'); if (x < sc.scrollLeft + 20 || x > sc.scrollLeft + sc.clientWidth - 40) sc.scrollLeft = x - sc.clientWidth * 0.15; }
  updatePinVisibility();
}

/* ---------- timeline ---------- */
const PAD = 8;
const tx = t => PAD + t * S.pps;
function lane(key, h) {
  const n = document.createElement('div'); n.textContent = tr('lane_' + key); n.style.height = h + 'px'; $('#tl-names').appendChild(n);
  const l = document.createElement('div'); l.className = 'lane'; l.dataset.lane = key; l.style.height = h + 'px'; $('#tl-lanes').appendChild(l);
  return l;
}
function buildTimeline() {
  $('#tl-names').innerHTML = ''; $('#tl-lanes').innerHTML = '';
  const D = S.data; S.lanes = {};
  if (D.beats.length) S.lanes.beats = lane('beats', 30);
  if (D.caps.length) S.lanes.caps = lane('caps', 24);
  S.lanes.pins = lane('pins', 26);
  if (!D.beats.length) { const n = document.createElement('div'); n.className = 'tl-note'; n.id = 'tl-note'; n.textContent = tr('oldFilm'); $('#tl-lanes').appendChild(n); }
  layoutTimeline();
}
function layoutTimeline() {
  if (!S.loop || !S.lanes) return;
  const sc = $('#tl-scroll'), W = S.freezePps ? S.loop * S.freezePps : Math.max(240, (sc.clientWidth - PAD * 2) * S.zoom);   // while a pace drag runs, the scale holds still
  S.pps = W / S.loop; $('#tl-inner').style.width = (W + PAD * 2) + 'px';
  drawRuler();
  const D = S.data, L = S.lanes;
  const canPace = paceEditable();
  if (L.beats) L.beats.innerHTML = D.beats.map((b, i) => `<div class="blk beat${S.pace.edits[b.key] ? ' edited' : ''}" data-i="${i}" data-tipk="beat" style="--c:${KIND_COLOR[b.kind] || 'var(--ink-3)'};left:${tx(b.t0)}px;width:${Math.max(2, (b.t1 - b.t0) * S.pps - 1)}px">${(b.t1 - b.t0) * S.pps > 34 ? `<span>${esc(b.name || tr('kind_' + b.kind))}</span>` : ''}${canPace ? `<i class="h" data-h="${i}"></i>` : ''}</div>`).join('');
  if (L.caps) L.caps.innerHTML = D.caps.map((c, i) => `<div class="blk cap" data-i="${i}" data-tipk="cap" style="left:${tx(c.t0)}px;width:${Math.max(2, (c.t1 - c.t0) * S.pps - 1)}px">${(c.t1 - c.t0) * S.pps > 40 ? esc(c.en) : ''}</div>`).join('');
  renderPinsLane(); updateNow();
}
function drawRuler() {
  const R = $('#tl-ruler'), steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
  const major = steps.find(s => s * S.pps >= 64) || 60, minor = major / (major >= 1 && major % 5 === 0 ? 5 : 2);
  let h = '';
  for (let t = 0; t <= S.loop + 1e-6; t += minor) {
    const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
    h += `<div class="tk${isMajor ? ' major' : ''}" style="left:${tx(t)}px">${isMajor ? `<span>${major < 1 ? t.toFixed(2) : Math.round(t)}s</span>` : ''}</div>`;
  }
  R.innerHTML = h;
}
function setZoom(z, anchorT) {
  const sc = $('#tl-scroll'), at = anchorT ?? S.t, before = tx(at) - sc.scrollLeft;
  S.zoom = Math.max(1, Math.min(40, z)); layoutTimeline();
  sc.scrollLeft = tx(at) - before;
}
const wasDur = b => { const w = S.base && S.base.beats.find(x => x.key === b.key); return w && Math.abs(w.dur - (b.t1 - b.t0)) > 0.005 ? w.dur : null; };
function tipFor(el) {
  const k = el.dataset.tipk, i = +el.dataset.i, D = S.data;
  if (k === 'beat') { const b = D.beats[i], was = wasDur(b); return `<b>${esc(b.name || '')}</b>\n<span class="k">${esc(tr('kind_' + b.kind))}</span> · ${esc(tr('bp_dur', { d: (b.t1 - b.t0).toFixed(2) }))}${was != null ? ' ' + esc(tr('bp_was', { d: (+was).toFixed(2) })) : ''}\n<span class="k">${esc(paceEditable() ? tr('dragHint') : paceWhyNot())}</span>`; }
  if (k === 'cap') { const c = D.caps[i]; return `<b>${esc(c.en)}</b>${c.sub ? '\n' + esc(c.sub) : ''}${c.ko ? '\n' + esc(c.ko) : ''}\n<span class="k">${fmtT(c.t0)} – ${fmtT(c.t1)}</span>`; }
  if (k === 'pin') { const p = S.review.pins.find(x => x.id === el.dataset.id); return p ? `<b>#${esc(p.id.replace(/\D/g, ''))}</b> ${fmtT(p.t)}\n${esc(p.text)}` : ''; }
  return '';
}

/* ---------- review pins ---------- */
const pinNo = p => String(p.id).replace(/\D/g, '');
async function loadReview() {
  if (!S.film) return; const id = S.film.id;
  try { const r = await api('/api/review?id=' + encodeURIComponent(id)); if (S.film && S.film.id === id) { S.review = r; renderPins(); renderReview(); } } catch (e) {}
}
function renderPins() { renderPinsLane(); renderPinsOnFrame(); }
function renderPinsLane() {
  const L = S.lanes && S.lanes.pins; if (!L || !S.pps) return;
  L.innerHTML = S.review.pins.map(p => `<div class="tpin${p.status === 'done' ? ' done' : ''}${p.id === S.sel ? ' sel' : ''}" data-id="${esc(p.id)}" data-t="${p.t}" data-tipk="pin" style="left:${tx(p.t)}px">${pinNo(p)}</div>`).join('');
}
function renderPinsOnFrame() {
  const L = $('#pin-layer');
  const pins = S.review.pins.filter(p => p.x != null && p.y != null);
  if (S.draft && S.draft.x != null) pins.push({ ...S.draft, id: 'draft', draft: true });
  L.innerHTML = pins.map(p => `<div class="fpin${p.status === 'done' ? ' done' : ''}${p.draft ? ' draft' : ''}${p.id === S.sel ? ' sel' : ''}" data-id="${esc(p.id)}" style="left:${p.x * 100}%;top:${p.y * 100}%"><i></i><b>${p.draft ? '+' : '#' + pinNo(p)}</b></div>`).join('');
  updatePinVisibility();
}
function updatePinVisibility() {
  const win = S.playing ? 0.35 : 0.6;
  for (const el of $('#pin-layer').children) {
    if (el.dataset.id === 'draft') { el.style.opacity = 1; continue; }
    const p = S.review.pins.find(x => x.id === el.dataset.id); if (!p) continue;
    let d = Math.abs(S.t - p.t); d = Math.min(d, S.loop - d);
    const a = d < win ? 1 - 0.7 * d / win : (p.id === S.sel && !S.playing ? 0.35 : 0);
    el.style.opacity = a.toFixed(2); el.style.display = a > 0 ? '' : 'none';
  }
}
function contextAt(t) {
  const b = S.data.beats.find(x => t >= x.t0 && t < x.t1), c = S.data.caps.find(x => t >= x.t0 && t <= x.t1);
  let tau = null; try { tau = typeof S.bw.tauOf === 'function' ? +(+S.bw.tauOf(t)).toFixed(3) : null; } catch (e) {}
  return { tau, beat: b ? `${b.kind} · ${b.name}` : null, caption: c ? c.en : null, file: S.file, build: S.film.mtime ? new Date(S.film.mtime).toISOString() : null };
}
function selectPin(id, { seekTo = true, scroll = true } = {}) {
  S.sel = id; const p = S.review.pins.find(x => x.id === id);
  if (p && seekTo) { setPlaying(false); seek(p.t); }
  renderPins(); renderReview();
  if (scroll) { const c = $(`.pin-card[data-id="${CSS.escape(id)}"]`); if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}
function renderReview() {
  const all = [...S.review.pins].sort((a, b) => a.t - b.t), open = all.filter(p => p.status !== 'done'), done = all.filter(p => p.status === 'done');
  $('#review-count').textContent = all.length ? tr('reviewCount', { o: open.length, a: all.length }) : '';
  const card = p => {
    const isDone = p.status === 'done', ctx = p.context && p.context.beat ? p.context.beat.split(' · ').slice(1).join(' · ') : '';
    return `<div class="pin-card${isDone ? ' done' : ''}${p.id === S.sel ? ' sel' : ''}" data-id="${esc(p.id)}">
      <div class="pin-top"><span class="pin-no">${pinNo(p)}</span><span class="pin-t">${fmtT(p.t)}</span><span class="pin-ctx">${esc(p.x == null ? tr('whole') + (ctx ? ' · ' + ctx : '') : ctx)}</span>
        <div class="spacer"></div><span class="pin-actions">${isDone ? `<button class="btn ghost small" data-act="toggle">${esc(tr('reopen'))}</button>`
          : `<button class="btn ghost small" data-act="edit">${esc(tr('edit'))}</button>`}<button class="btn ghost small danger" data-act="del">${esc(tr('del'))}</button></span></div>
      <div class="pin-text">${esc(p.text)}</div>
      ${p.reply ? `<div class="pin-reply"><b>CLAUDE${p.resolvedIn ? ' · ' + esc(p.resolvedIn) : ''}</b>${esc(p.reply)}</div>` : ''}
      ${!p.snap && !isDone ? `<div class="pin-snap">${esc(tr('snapping'))}</div>` : ''}</div>`;
  };
  $('#review-list').innerHTML = (open.length ? open.map(card).join('') : `<div class="empty-note">${all.length ? esc(tr('noOpen')) : tr('noPins')}</div>`)
    + (done.length ? `<div class="done-head">${esc(tr('doneHead', { n: done.length }))}</div>` + done.map(card).join('') : '');
  $('#copy-claude').disabled = !open.length;
}
async function reviewOp(body) {
  try { S.review = await api('/api/review?id=' + encodeURIComponent(S.film.id), { body }); renderPins(); renderReview(); return true; }
  catch (e) { toast(esc(e.message), 'err'); return false; }
}
function openPop(p, cx, cy) {
  S.draft = p; renderPinsOnFrame();
  const pop = $('#pop'), ta = $('#pop-text'); pop.hidden = false; ta.value = '';
  const w = 280, h = 150, x = Math.min(window.innerWidth - w - 12, Math.max(12, cx + 16)), y = Math.min(window.innerHeight - h - 12, Math.max(12, cy - 24));
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
  setTimeout(() => ta.focus(), 0);
}
function closePop() { $('#pop').hidden = true; S.draft = null; renderPinsOnFrame(); }
async function savePop() {
  const text = $('#pop-text').value.trim(), d = S.draft; if (!d) return;
  if (!text) { closePop(); return; }
  const ok = await reviewOp({ op: 'add', t: d.t, x: d.x, y: d.y, text, file: S.file, context: contextAt(d.t) });
  closePop();
  if (ok) { const last = S.review.pins.reduce((m, p) => (+pinNo(p) > +pinNo(m) ? p : m), S.review.pins[0]); if (last) S.sel = last.id; renderPins(); renderReview(); toast(esc(tr('saved')), 'ok'); }
}

/* ---------- render ---------- */
function renderGate() {                                     // is this build checked? (full QA + visual review — the delivery gate)
  const el = $('#render-gate'), g = S.film && S.film.gate;
  if (!g) { el.hidden = true; return; }
  const k = { 'qa-none': 'gate_qaNone', 'qa-old': 'gate_qaOld', 'qa-partial': 'gate_qaPartial', 'review-none': 'gate_reviewNone', 'review-old': 'gate_reviewOld', 'review-fail': 'gate_reviewFail', 'review-failed': 'gate_reviewFail' };
  const names = { pace: tr('chk_pace'), read: tr('chk_read'), empty: tr('chk_empty'), surfaces: tr('chk_surfaces'), engine: tr('chk_engine'), flicker: tr('chk_flicker') };
  const why = (g.codes || []).map(c => c.startsWith('qa-fail:') ? tr('gate_qaFail', { x: c.slice(8).split(',').map(n => names[n] || n).join(', ') }) : tr(k[c] || c));
  el.hidden = false; el.classList.toggle('ok', !!g.ok);
  el.innerHTML = g.ok ? `<i></i>${esc(tr('gateOk'))}` : `<i></i><b>${esc(tr('gateNo'))}</b><span>${esc(why.join(' · '))}</span>`;
}
function renderRenderList() {
  renderGate();
  const box = $('#render-list'); if (!S.film) { box.innerHTML = ''; return; }
  const rs = S.film.renders || [];
  box.innerHTML = rs.length ? rs.slice(0, 3).map(r => `<div class="rfile${S.justRendered === r.file ? ' new' : ''}"><span class="nm" title="${esc(r.file)}">${esc(base(r.file))}</span><span class="meta">${fmtBytes(r.size)}</span>
    <a href="/f/${encPath(r.file)}" target="_blank" rel="noopener">${esc(tr('open'))}</a><a href="#" data-reveal="${esc(r.file)}">${esc(tr('reveal'))}</a></div>`).join('')
    : `<div class="empty-note">${esc(tr('noRenders'))}</div>`;
}
function onRender(job, quiet) {
  const prev = S.job; S.job = job; if (!job) return;
  const box = $('#render-job'), mine = S.film && job.film === S.film.id;
  box.hidden = !(mine || job.status === 'running');
  const pct = job.total ? job.frame / job.total : 0;
  $('#render-bar').style.width = (job.status === 'done' ? 100 : pct * 100).toFixed(1) + '%';
  $('#render-cancel').hidden = job.status !== 'running';
  $('#render-start').disabled = job.status === 'running';
  let s = '';
  if (job.status === 'running') {
    const fps = job.elapsed > 0 ? job.frame / job.elapsed : 0, eta = fps > 0 ? (job.total - job.frame) / fps : 0;
    s = job.total ? `${tr('rendering')} ${job.frame}/${job.total} · ${fps.toFixed(1)} fps · ${fmtDur(eta)} ${tr('left')}` : `${tr('rendering')}…`;
    if (!mine) s = tr('otherFilm', { f: job.film }) + ' · ' + s;
  } else if (job.status === 'done') s = tr('renderDone', { s: job.seconds, e: Math.round(job.elapsed) });
  else if (job.status === 'error') s = tr('renderErr', { e: job.error || '' });
  else if (job.status === 'cancelled') s = tr('renderCancelled');
  $('#render-status').textContent = s;
  if (!quiet && prev && prev.status === 'running' && job.status !== 'running') {
    if (job.status === 'done') { S.justRendered = job.out; toast(`${esc(tr('renderDone', { s: job.seconds, e: Math.round(job.elapsed) }))} · <a href="/f/${encPath(job.out)}" target="_blank" style="color:var(--accent)">${esc(tr('open'))}</a>`, 'ok', 8000); refreshFilm(); }
    else if (job.status === 'error') toast(esc(s), 'err', 8000);
  }
}
async function refreshFilm() {
  if (!S.film) return;
  try { const f = await api('/api/film?id=' + encodeURIComponent(S.film.id)); Object.assign(S.film, f); fillSelects(); renderRenderList(); } catch (e) {}
}

/* ---------- live updates ---------- */
let offlineTimer = 0;
function connectEvents() {                                   // one stream per page: its film's files, renders, Claude, "open this film"
  if (S.es) S.es.close();
  const es = S.es = new EventSource(S.film ? `/api/events?id=${encodeURIComponent(S.film.id)}&file=${encodeURIComponent(S.file || '')}` : '/api/events');
  es.onopen = () => { clearTimeout(offlineTimer); $('#offline').hidden = true; };
  es.onerror = () => { clearTimeout(offlineTimer); offlineTimer = setTimeout(() => { if (es.readyState !== 1) $('#offline').hidden = false; }, 2500); };
  es.addEventListener('hello', e => { const d = JSON.parse(e.data);
    if (d.ui) { if (S.ui && S.ui !== d.ui) { reloadWhenFree(); return; } S.ui = d.ui; }       // the Studio was updated: load its new page
    if (d.job) onRender(d.job, true); if (d.claude) { S.claude = d.claude; renderClaude(); } });
  es.addEventListener('claude', e => { S.claude = JSON.parse(e.data); renderClaude(); });
  es.addEventListener('ui', e => { const d = JSON.parse(e.data); if (S.ui && d.ui !== S.ui) reloadWhenFree(); });
  es.addEventListener('goto', async e => {                   // Claude opened the Studio on a film (server.mjs run again)
    const d = JSON.parse(e.data);
    if (d.film && !(S.film && S.film.id === d.film)) await loadFilms(true, d.film); else await loadFilms(true);
    if (d.view && S.film && (!d.film || S.film.id === d.film)) setView(d.view);
    toast(esc(tr('opened')), 'ok', 5000); flashTitle();
  });
  if (!S.film) return;
  es.addEventListener('storyboard', () => { const v0 = S.sb && S.sb.version; loadStoryboard().then(() => { if (S.sb && v0 && S.sb.version > v0) toast(esc(tr('sbNewVersion', { v: S.sb.version })), 'ok', 6000); }); });
  let sbt = 0;
  es.addEventListener('sbframe', e => { const d = JSON.parse(e.data); S.sbf.frames[d.id] = { file: d.file, t: d.t }; S.sbf.stamp = d.stamp; S.sbf.running = true; S.sbf.making = (S.sbf.making || 0) + 1; patchSbFrame(d.id); });
  es.addEventListener('sbframes', () => { S.sbf.running = false; S.sbf.making = 0; loadSbFrames(); });   // the whole new set (scenes this build doesn't reach drop out)
  es.addEventListener('html', async e => {
    const d = JSON.parse(e.data);
    if (S.view === 'board') { clearTimeout(sbt); sbt = setTimeout(loadSbFrames, 1500); }
    if (d.first) { const id = S.film.id; await loadFilms(true); if (S.film && S.film.id === id && S.film.html) { toast(esc(tr('firstBuild')), 'ok', 6000); selectFilm(id); setView('film'); } return; }
    if (d.file !== S.file) return;
    if (Date.now() < S.expectSaveUntil) { S.expectSaveUntil = 0; refreshFilm(); return; }   // our own pace save: the page already plays it
    S.resume = S.playing; setPlaying(false);
    refreshFilm().then(() => { loadFrame(); toast(esc(tr('reloaded', { t: new Date(d.mtime).toLocaleTimeString() })), 'ok'); });
  });
  let rt = 0; es.addEventListener('review', () => { clearTimeout(rt); rt = setTimeout(loadReview, 150); });
  es.addEventListener('render', e => onRender(JSON.parse(e.data)));
  let gt = 0; es.addEventListener('gate', () => { clearTimeout(gt); gt = setTimeout(refreshFilm, 300); });
}
function reloadWhenFree() {                                  // new page code: reload — but never under the requester's hands (typing, a comment open)
  if (busy()) { setTimeout(reloadWhenFree, 4000); return; }
  if (S.film) { const h = new URLSearchParams({ film: S.film.id, t: S.t.toFixed(2), view: S.view }); if (S.file !== S.film.html) h.set('file', S.file); history.replaceState(null, '', '#' + h); }
  location.reload();
}
let titleTimer = 0;
function flashTitle() {                                      // the tab says so when it is in the background
  if (!document.hidden) return; clearInterval(titleTimer); let n = 0; const t0 = 'Promptfilm Studio';
  titleTimer = setInterval(() => { document.title = n++ % 2 ? t0 : '● ' + t0; if (!document.hidden) { clearInterval(titleTimer); document.title = t0; } }, 900);
}

/* ---------- pace: the requester's speed edits (drag a beat's right edge, or edit it), played live, saved into the film ---------- */
const paceEditable = () => S.pace.supported && S.file === S.film.html && S.ready && typeof S.bw.retime === 'function';
const paceWhyNot = () => tr(S.file !== (S.film && S.film.html) ? 'paceNoFile' : 'paceNoEngine');
async function loadPace() {
  S.pace = { supported: false, why: '', edits: {}, saved: {} }; S.paceUndo = []; S.base = null;
  if (!S.film || !S.bw) return;
  try { const r = await api('/api/pace?id=' + encodeURIComponent(S.film.id)); S.pace = { supported: !!r.supported, why: r.why || '', edits: { ...(r.edits || {}) }, saved: r.edits || {} }; } catch (e) {}
  if (typeof S.bw.retime === 'function') {                   // the authored pace, for "was … s" (the build may already carry edits)
    try { S.bw.retime({}); S.base = { loop: S.bw.LOOP, beats: S.bw.beats() }; S.bw.retime(S.pace.edits); readTiming(); } catch (e) {}
  }
  renderPaceBar(); layoutTimeline();
}
function readTiming() {
  const b = S.bw, D = S.data, call = f => { try { return typeof b[f] === 'function' ? b[f]() : null; } catch (e) { return null; } };
  S.loop = b.LOOP; D.beats = call('beats') || []; D.caps = call('captions') || [];
}
function paceSet(b, patch) {
  const cur = { ...(S.pace.edits[b.key] || {}) };
  for (const [k, v] of Object.entries(patch)) { if (v == null) delete cur[k]; else cur[k] = v; }
  const cls = S.bw.SPEED_CLASS || {}, kind = cur.kind || b.authored.kind, base = b.authored.speed || cls[kind];
  if (cur.kind === b.authored.kind) delete cur.kind;
  if (cur.speed != null) { cur.speed = Math.round(Math.min(16, Math.max(0.25, cur.speed)) * 100) / 100; if (Math.abs(cur.speed - (b.authored.speed || cls[kind])) < 1e-6 && !cur.kind) delete cur.speed; }
  if (Object.keys(cur).length) S.pace.edits[b.key] = cur; else delete S.pace.edits[b.key];
  return base;
}
function paceRetime(tauKeep) {
  const tau = tauKeep ?? (typeof S.bw.tauOf === 'function' ? S.bw.tauOf(S.t) : null);
  S.bw.retime(S.pace.edits); readTiming();
  if (tau != null) S.t = Math.min(S.loop - 1e-3, S.bw.tOf(tau));
  redraw(); layoutTimeline(); renderTotal(); renderPaceBar(); renderPins();
}
const paceSnapshot = () => { S.paceUndo.push(JSON.stringify(S.pace.edits)); if (S.paceUndo.length > 50) S.paceUndo.shift(); };
function paceUndo() { if (!S.paceUndo.length || !paceEditable()) return; S.pace.edits = JSON.parse(S.paceUndo.pop()); paceRetime(); paceSave(); if (!$('#beatpop').hidden) openBeatPop(S.bpIndex, true); }
let paceTimer = 0;
function paceSave(label) {
  clearTimeout(paceTimer);
  paceTimer = setTimeout(async () => {
    S.expectSaveUntil = Date.now() + 5000;
    try { const r = await api('/api/pace?id=' + encodeURIComponent(S.film.id), { body: { edits: S.pace.edits } }); S.pace.saved = r.edits;
      toast(`${esc(label || tr('paceSavedMany'))} · <a href="#" data-undo style="color:var(--accent)">${esc(tr('paceUndo'))}</a>`, 'ok', 5000); }
    catch (e) { S.expectSaveUntil = 0; toast(esc(tr('paceErr', { e: e.message })), 'err', 8000); }
  }, 450);
}
function paceDrag(e, i, inner) {
  const b = S.data.beats[i]; if (!b) return;
  setPlaying(false); closeBeatPop(); paceSnapshot();
  const tau = S.bw.tauOf(S.t), x0 = e.clientX, dur0 = b.t1 - b.t0, sp0 = +b.speed;
  S.freezePps = S.pps; inner.setPointerCapture(e.pointerId); document.body.classList.add('pacing');
  let raf = 0, pending = null;
  const move = ev => {
    const dur = Math.max(0.08, dur0 + (ev.clientX - x0) / S.freezePps);
    pending = Math.round(Math.min(16, Math.max(0.25, sp0 * dur0 / dur)) * 20) / 20;       // steps of 0.05
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; paceSet(S.data.beats[i], { speed: pending }); paceRetime(tau); });
  };
  const up = () => {
    inner.removeEventListener('pointermove', move); inner.removeEventListener('pointerup', up); inner.removeEventListener('pointercancel', up);
    cancelAnimationFrame(raf); if (pending != null) { paceSet(S.data.beats[i], { speed: pending }); paceRetime(tau); }
    S.freezePps = 0; document.body.classList.remove('pacing'); layoutTimeline();
    if (pending == null) { S.paceUndo.pop(); return; }
    paceSave(tr('paceSaved', { name: b.name }));
  };
  inner.addEventListener('pointermove', move); inner.addEventListener('pointerup', up); inner.addEventListener('pointercancel', up);
}
function renderPaceBar() {                                   // in the transport, only while there are pace edits: how many, the old length, undo, reset
  const n = Object.keys(S.pace.edits || {}).length, ok = S.film && S.ready && paceEditable();
  $('#pace-bar').hidden = !ok || !n;
  if (!ok || !n) return;
  $('#pace-sum').textContent = tr('paceBar', { n, o: S.base ? S.base.loop.toFixed(1) : '–' });
  $('#pace-undo').disabled = !S.paceUndo.length;
}
function openBeatPop(i, keep) {                              // a beat: how long it plays, slower / faster, reset
  const b = S.data.beats[i]; if (!b || !paceEditable()) return;
  S.bpIndex = i;
  const pop = $('#beatpop'), was = wasDur(b);
  $('#bp-name').textContent = b.name || ''; $('#bp-sw').style.background = KIND_COLOR[b.kind] || 'var(--ink-3)';
  $('#bp-kind').textContent = tr('kind_' + b.kind);
  $('#bp-dur').innerHTML = `<b>${esc(tr('bp_dur', { d: (b.t1 - b.t0).toFixed(2) }))}</b>${was != null ? ' ' + esc(tr('bp_was', { d: (+was).toFixed(2) })) : ''}`;
  $('#bp-slower').disabled = +b.speed <= 0.25 + 1e-6; $('#bp-faster').disabled = +b.speed >= 16 - 1e-6;
  $('#bp-reset').disabled = !S.pace.edits[b.key];
  pop.hidden = false;
  if (!keep) {
    const el = $(`.blk.beat[data-i="${i}"]`), r = el ? el.getBoundingClientRect() : { left: 200, top: 400 };
    pop.style.left = Math.max(8, Math.min(window.innerWidth - 248, r.left)) + 'px'; pop.style.top = Math.max(8, r.top - pop.offsetHeight - 8) + 'px';
  }
}
function paceStep(k) {                                       // slower / faster: the beat plays 1.25× longer / shorter
  const b = S.data.beats[S.bpIndex]; if (!b) return;
  paceSnapshot(); paceSet(b, { speed: +b.speed * k }); paceRetime(); paceSave(tr('paceSaved', { name: b.name })); openBeatPop(S.bpIndex, true);
}
function closeBeatPop() { $('#beatpop').hidden = true; S.bpIndex = null; }

/* ---------- storyboard: Claude's plan as scene cards, reviewed before the build ---------- */
async function loadStoryboard() {
  if (!S.film || !S.film.storyboard || !S.film.sbTime) { S.sb = null; renderTabs(); return; }   // sbTime 0: no storyboard.json
  const id = S.film.id;
  try { const r = await api('/api/storyboard?id=' + encodeURIComponent(id)); if (!S.film || S.film.id !== id) return; S.sb = r.storyboard; }
  catch (e) { if (S.film && S.film.id === id) S.sb = null; }
  renderTabs(); if (S.view === 'board') renderBoard();
}
const sbReview = () => (S.sb && S.sb.review) || {};
const sbStatus = id => (sbReview().scenes || {})[id] || null;
const sbRef = r => '/f/' + encPath((S.film.dir && S.film.dir !== '.' ? S.film.dir + '/' : '') + r);
// the storyboard: what the requester needs to say "yes" or "change this" to each scene — a picture, what happens, the words on
// screen. How the camera moves, the facts and their sources and what is drawn without a source stay one click away (Details).
// a card's picture, best first: the film's own frame at that moment (a build exists) · a look frame Claude rendered before the
// build (x.frame) · a research photo, marked as one · nothing yet
async function loadSbFrames() {
  if (!S.film || !S.film.html || !S.film.sbTime) return; const id = S.film.id;
  try { const r = await api('/api/sbframes?id=' + encodeURIComponent(id)); if (!S.film || S.film.id !== id) return;
    S.sbf = { stamp: r.stamp, frames: r.stamp ? r.frames || {} : S.sbf.frames, running: !!r.running, making: 0 };
    if (S.view === 'board') renderBoard(); } catch (e) {}
}
const sbAspect = () => String((S.sb && S.sb.format && S.sb.format.aspect) || (S.film && S.film.aspect) || '9x16').replace('x', ' / ');
function sbPicture(x) {
  const real = S.sbf.frames[x.id], refs = x.refs || [];
  if (real) return `<button class="sc-frame real" data-play="${real.t}" title="${esc(tr('playHere'))}"><img loading="lazy" src="/f/${encPath(real.file)}?v=${esc(S.sbf.stamp)}" alt=""><span class="src">${esc(tr('srcBuild', { t: fmtT(real.t) }))}</span><i class="play"></i></button>`;
  if (x.frame) return `<div class="sc-frame look"><img loading="lazy" src="${sbRef(x.frame)}" data-full="${sbRef(x.frame)}" alt=""><span class="src">${esc(tr('srcLook'))}</span></div>`;
  if (refs[0]) return `<div class="sc-frame ref"><img loading="lazy" src="${sbRef(refs[0])}" data-full="${sbRef(refs[0])}" alt=""><span class="src">${esc(tr('srcRef'))}</span></div>`;
  return `<div class="sc-frame none"><span>${esc(tr(S.sbf.running ? 'srcMaking' : S.film.html ? 'srcNotYet' : 'srcNone'))}</span></div>`;
}
function patchSbFrame(id) {                                  // one card's picture arrived: swap just that picture (details, notes stay as they are)
  if (S.view !== 'board' || !S.sb) return; const x = (S.sb.scenes || []).find(y => y.id === id), el = document.querySelector(`#sc-${CSS.escape(id)} .sc-frame`);
  if (x && el) { el.outerHTML = sbPicture(x); const c = document.getElementById('sc-' + id); if (c) c.classList.toggle('noframe', !(S.sbf.frames[id] || x.frame || (x.refs || [])[0])); }
  const m = $('#bd-making'); if (m) { const n = (S.sb.scenes || []).length; m.hidden = !S.sbf.making || S.sbf.making >= n; m.textContent = tr('sbFramesMaking', { n: S.sbf.making, m: n }); }
}
const plainLine = c => { if (!c) return ''; const two = String(c.second || '').trim().replace(/^\((.*)\)$/s, '$1');
  return two || [c.title, c.line].filter(Boolean).join(' · '); };
function renderBoard() {
  const box = $('#board'); if (!S.view || S.view !== 'board') return;
  if (document.activeElement && box.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') return;   // not while typing
  const sb = S.sb, top = box.scrollTop;
  if (!sb) { box.innerHTML = `<div class="bd-empty">${esc(tr('sbEmpty'))}</div>`; return; }
  const scenes = sb.scenes || [], rv = sbReview(), F = sb.format || {}, v = sb.version || 1;
  const est = sb.estimate || scenes.reduce((a, x) => a + (+x.seconds || 0), 0);
  const range = String(F.length || '').split('-').map(Number), inRange = range.length === 2 ? est >= range[0] - 0.5 && est <= range[1] + 0.5 : true;
  const counts = { ok: 0, ch: 0 }; scenes.forEach(x => { const st = sbStatus(x.id); if (st && st.status === 'ok') counts.ok++; if (st && st.status === 'change') counts.ch++; });
  const locked = !!rv.approved;                              // approved: the plan is settled — the board shows the scenes; changes go on the film
  const chip = (t, warn) => `<span class="chip${warn ? ' warn' : ''}">${esc(t)}</span>`;
  const card = (x, i) => {
    const st = sbStatus(x.id), status = st ? st.status : '', cap = plainLine(x.caption), refs = x.refs || [], facts = x.facts || [];
    const more = (x.camera ? `<dt>${esc(tr('sbCamera'))}</dt><dd>${esc(x.camera)}</dd>` : '')
      + (x.caption && x.caption.title ? `<dt>${esc(tr('sbCaption'))}</dt><dd>${esc([x.caption.title, x.caption.line].filter(Boolean).join(' — '))}</dd>` : '')
      + (facts.length ? `<dt>${esc(tr('sbFactsHead'))}</dt><dd><ul>${facts.map(f => typeof f === 'string' ? `<li>${esc(f)}</li>` : `<li>${esc(f.text || '')}${f.source ? ` <small>— ${esc(f.source)}</small>` : ''}</li>`).join('')}</ul></dd>` : '')
      + (x.illustrative ? `<dt>${esc(tr('sbIllShort'))}</dt><dd>${esc(x.illustrative)}</dd>` : '')
      + (refs.length > (S.sbf.frames[x.id] || x.frame ? 0 : 1) ? `<dt>${esc(tr('srcRef'))}</dt><dd class="sc-thumbs">${refs.slice(S.sbf.frames[x.id] || x.frame ? 0 : 1, 4).map(r => `<img loading="lazy" src="${sbRef(r)}" data-full="${sbRef(r)}" alt="">`).join('')}</dd>` : '');
    const noPic = !(S.sbf.frames[x.id] || x.frame || refs[0]);
    return `<article class="sc ${status}${noPic ? ' noframe' : ''}" id="sc-${esc(x.id)}" data-id="${esc(x.id)}" style="--c:${KIND_COLOR[x.beat] || 'var(--ink-3)'}">
      ${x.changedIn && +x.changedIn === v && v > 1 ? `<span class="sc-new">${esc(tr('sbChanged'))}</span>` : ''}
      ${sbPicture(x)}
      <div class="sc-top"><span class="no">${i + 1}</span><b>${esc(x.name || '')}</b>${x.illustrative ? `<span class="ill" title="${esc(tr('sbIll', { t: x.illustrative }))}">${esc(tr('sbIllShort'))}</span>` : ''}${x.seconds ? `<span class="sec" title="${esc(x.beat ? tr('kind_' + x.beat) : '')}">${esc(tr('sbSec', { s: (+x.seconds).toFixed(1) }))}</span>` : ''}</div>
      ${x.sees ? `<p class="sc-sees">${esc(x.sees)}</p>` : ''}
      ${cap ? `<p class="sc-cap">“${esc(cap)}”</p>` : ''}
      ${more ? `<details class="sc-more"><summary>${esc(tr('sbMore'))}</summary><dl>${more}</dl></details>` : ''}
      ${locked ? '' : `<div class="sc-act"><button class="btn small${status === 'ok' ? ' on-ok' : ''}" data-st="ok">${esc(tr('sbOk'))}</button><button class="btn small${status === 'change' ? ' on-change' : ''}" data-st="change">${esc(tr('sbChange'))}</button></div>
      ${status === 'change' ? `<textarea rows="2" placeholder="${esc(tr('sbNotePh'))}">${esc(st.note || '')}</textarea>` : ''}`}
    </article>`;
  };
  const when = t => new Date(t).toLocaleString(LANG === 'ko' ? 'ko-KR' : 'en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const busy = sbBusy();
  box.innerHTML = `<div class="bd-wrap">
    <header class="bd-head">
      <h1>${esc(sb.title || S.film.name)}</h1>
      <div class="bd-meta">${chip(tr('sbScenes', { n: scenes.length }) + ' · ' + tr('sbEstimate', { e: est.toFixed(0) }) + (F.length ? ' · ' + tr('sbTarget', { r: F.length }) : ''), !inRange)}${v > 1 ? chip(tr('sbVersion', { v })) : ''}</div>
      ${sb.summary ? `<p class="bd-sum" title="${esc(tr('sbSumMore'))}">${esc(sb.summary)}</p>` : ''}
      ${rv.reply ? `<div class="bd-callout"><b>${esc(tr('sbReply', { v }))}</b>${esc(rv.reply)}</div>` : ''}
      ${(sb.open || []).length ? `<div class="bd-q"><b>${esc(tr('sbQuestions'))}</b>${sb.open.map((q, i) => `<label>${esc(q)}</label><textarea rows="2" data-answer="${i}" placeholder="${esc(tr('sbAnswerPh'))}">${esc(((a) => a && typeof a === 'object' ? a.a : a || '')((rv.answers || {})[i]))}</textarea>`).join('')}</div>` : ''}
    </header>
    <div id="bd-making" class="bd-making" hidden></div>
    <div class="bd-grid${/^(9x16|4x5)$/.test(String((sb.format && sb.format.aspect) || S.film.aspect)) ? ' tall' : ''}" style="--ar:${sbAspect()}">${scenes.map(card).join('')}</div>
    ${locked ? `<footer class="bd-foot done"><div class="bd-approved">${esc(tr('sbLocked', { t: when(rv.approved) }))}</div><div class="state"><span id="bd-claude"></span></div></footer>` : `<footer class="bd-foot"><textarea id="sb-note" rows="1" placeholder="${esc(tr('sbNotePhAll'))}">${esc(rv.note || '')}</textarea>
      <div class="btns">${counts.ch ? `<button class="btn primary" data-send="revise">${esc(tr('sbRevise'))}</button><button class="btn" data-send="approve">${esc(tr('sbApproveFix'))}</button>`
        : `<button class="btn primary" data-send="approve"${busy ? ' disabled' : ''}>${esc(tr('sbApprove'))}</button>`}
        <div class="state"><span id="bd-claude"></span>
          ${esc(tr('sbCounts', { ok: counts.ok, ch: counts.ch, no: scenes.length - counts.ok - counts.ch }))}${rv.sent ? ' · ' + esc(tr('sbSentAt', { t: when(rv.sent) })) : ''}</div></div></footer>`}
  </div>`;
  box.scrollTop = top; renderBoardClaude();
}
const sbBusy = () => { const c = S.claude || {}; return !!(c.active && S.film && c.active.film === S.film.id); };
function renderBoardClaude() {                                // the storyboard's footer: is a Claude session waiting for this film, or working on it?
  const el = $('#bd-claude'); if (!el) return; const c = S.claude || {}, busy = sbBusy();
  el.className = 'cstate ' + (busy ? 'busy' : c.listening ? 'on' : 'off'); el.title = c.listening || busy ? '' : tr('cl_offTip');
  el.innerHTML = `<i></i>${esc(busy ? tr('sbWorking') : tr(c.listening ? 'cl_on' : 'cl_off'))}`;
  const b = $('#board [data-send="approve"]'); if (b && !$('#board [data-send="revise"]')) b.disabled = busy;
}
async function sbOp(body) {
  try { const r = await api('/api/storyboard?id=' + encodeURIComponent(S.film.id), { body }); S.sb = r.storyboard; return r; }
  catch (e) { toast(esc(e.message), 'err'); return null; }
}
function wireBoard() {
  const box = $('#board');
  box.addEventListener('click', async e => {
    const img = e.target.closest('img[data-full]'); if (img) { $('#lightbox img').src = img.dataset.full; $('#lightbox').hidden = false; return; }
    const sum = e.target.closest('.bd-sum'); if (sum) { sum.classList.toggle('open'); return; }
    const play = e.target.closest('[data-play]'); if (play) { const t = +play.dataset.play; setView('film'); S.resume = false; if (S.ready) seek(t); else S.t = t; return; }
    const stb = e.target.closest('[data-st]');
    if (stb) {
      const id = stb.closest('.sc').dataset.id, cur = sbStatus(id), want = stb.dataset.st;
      if (cur && cur.status === want) await sbOp({ op: 'scene', id, status: null });
      else await sbOp({ op: 'scene', id, status: want, note: cur ? cur.note : '' });
      renderBoard();
      if (want === 'change') { const ta = document.querySelector(`#sc-${CSS.escape(id)} textarea`); if (ta) ta.focus(); }
      return;
    }
    const send = e.target.closest('[data-send]');
    if (send) {
      const approve = send.dataset.send === 'approve', note = $('#sb-note').value;
      const n = (S.sb.scenes || []).filter(x => (sbStatus(x.id) || {}).status === 'change').length;
      send.disabled = true;                                        // one press is one request
      const r = await sbOp({ op: 'send', approve, note }); if (!r) { send.disabled = false; return; }
      renderBoard();
      if (r.delivered) toast(esc(tr('sbSent', { what: tr(approve ? 'sbWhatApprove' : 'sbWhatRevise') })), 'ok', 7000);
      else if (r.busy) toast(esc(tr('alreadyWorking')), 'ok', 7000);
      else { const text = tr('sbCopy', { what: tr(approve ? 'sbCopyApprove' : 'sbCopyRevise'), dir: S.film.dir === '.' ? S.film.name : S.film.dir, n, file: S.film.storyboard });
        try { await navigator.clipboard.writeText(text); toast(esc(tr('notListening')), 'ok', 7000); } catch (err) { toast(esc(text), '', 9000); } }
    }
  });
  box.addEventListener('focusout', async e => {                     // notes and answers are saved when the box is left
    const ta = e.target; if (ta.tagName !== 'TEXTAREA') return;
    if (ta.id === 'sb-note') { if (ta.value !== (sbReview().note || '')) await sbOp({ op: 'note', note: ta.value }); return; }
    if (ta.dataset.answer != null) { await sbOp({ op: 'answer', i: ta.dataset.answer, text: ta.value }); return; }
    const c = ta.closest('.sc'); if (c) { const st = sbStatus(c.dataset.id); if (!st || st.note !== ta.value) await sbOp({ op: 'scene', id: c.dataset.id, status: 'change', note: ta.value }); }
    setTimeout(renderBoard, 0);
  });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.tagName === 'TEXTAREA') e.target.blur(); });
}

/* ---------- Claude: is a Claude Code session waiting for "Send to Claude"? ---------- */
function renderClaude() {
  renderBoardClaude();
  const c = S.claude || {}, el = $('#claude-state'), busy = c.active && S.film && c.active.film === S.film.id;
  el.className = 'cstate ' + (busy ? 'busy' : c.listening ? 'on' : 'off');
  const mins = busy ? Math.max(0, Math.round((Date.now() - c.active.since) / 60000)) : 0;
  el.querySelector('span').textContent = busy ? tr('cl_busy', { m: mins < 1 ? (LANG === 'ko' ? '방금' : 'just now') : (LANG === 'ko' ? `${mins}분` : `${mins} min`) }) : tr(c.listening ? 'cl_on' : 'cl_off');
  el.title = c.listening || busy ? '' : tr('cl_offTip');
  $('#copy-claude').textContent = tr(c.listening ? 'sendClaude' : 'copyInstead');
}

/* ---------- help ---------- */
function renderHelp() {                                      // the keys (the rarely needed views live here: T, S, zoom) and the language
  const rows = [['Space', 'h_space'], ['← →', 'h_arrows'], ['⇧ ← →', 'h_sarrows'], ['Home End', 'h_home'], ['C', 'h_c'], ['T', 'h_t'], ['S', 'h_s'], ['+ − 0 · ⌘ wheel', 'h_zoom'], ['⌘Z', 'h_undo'], ['Esc', 'h_esc']];
  $('#help').innerHTML = `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(tr(v))}</dd>`).join('')}</dl>
    <div class="help-lang"><span>${esc(tr('h_lang'))}</span><div class="seg"><button data-lang="ko" class="${LANG === 'ko' ? 'on' : ''}">한국어</button><button data-lang="en" class="${LANG === 'en' ? 'on' : ''}">English</button></div></div>`;
}
function setLang(l) {
  LANG = l; store.set('lang', LANG); applyI18n(); renderHelp();
  if (S.ready) buildTimeline(); renderReview(); renderTotal(); renderRenderList(); fillSelects(); renderClaude(); renderPaceBar();
  if (S.job) onRender(S.job, true); if (!S.films.length) showEmpty(); if (S.view === 'board') renderBoard();
}

/* ---------- wiring ---------- */
function setCommenting(on) {
  S.commenting = on; $('#tg-comment').classList.toggle('on', on); $('#hit').classList.toggle('commenting', on); $('#mode-hint').hidden = !on;
  if (on) setPlaying(false);
}
function wire() {
  $('#film-select').onchange = e => selectFilm(e.target.value);
  $('#version-select').onchange = e => { S.file = e.target.value; setPlaying(false); connectEvents(); loadFrame(); saveHash(); };
  $('#play').onclick = () => setPlaying(!S.playing);
  $('#step-back').onclick = () => step(-1);
  $('#step-fwd').onclick = () => step(1);
  $('#rate').onchange = e => { S.rate = +e.target.value; };
  $('#tg-comment').onclick = () => setCommenting(!S.commenting);
  $('#help-btn').onclick = e => { e.stopPropagation(); $('#help').hidden = !$('#help').hidden; };
  $('#help').addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (b && b.dataset.lang !== LANG) setLang(b.dataset.lang); });
  document.addEventListener('click', e => { if (!$('#help').hidden && !e.target.closest('#help')) $('#help').hidden = true; });
  // the film list stays current by itself: read again when the Studio's window comes back (at most every 4 s)
  const back = () => { if (!document.hidden && Date.now() - filmsAt > 4000) loadFilms(true); };
  window.addEventListener('focus', back); document.addEventListener('visibilitychange', back);

  // the frame: click = play / pause; in comment mode, click = pin a comment there
  $('#hit').addEventListener('click', e => {
    if (!S.ready) return;
    if (!S.commenting) { setPlaying(!S.playing); return; }
    const r = $('#stage').getBoundingClientRect();
    setPlaying(false);
    openPop({ t: S.t, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }, e.clientX, e.clientY);
  });
  $('#pin-layer').addEventListener('click', e => { const f = e.target.closest('.fpin'); if (f && f.dataset.id !== 'draft') { e.stopPropagation(); selectPin(f.dataset.id); } });
  $('#pop-save').onclick = savePop;
  $('#pop-cancel').onclick = closePop;
  $('#pop-text').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); savePop(); }
    if (e.key === 'Escape') { e.preventDefault(); closePop(); }
  });
  $('#add-general').onclick = e => { if (!S.ready) return; setPlaying(false); const r = e.target.getBoundingClientRect(); openPop({ t: S.t, x: null, y: null }, r.left - 300, r.top - 150); };
  $('#copy-claude').onclick = async () => {
    const n = S.review.pins.filter(p => p.status !== 'done').length;
    if (S.claude.listening) {
      try { const r = await api('/api/ask?id=' + encodeURIComponent(S.film.id), { body: {} }); if (r.delivered) { toast(esc(tr('sent', { n: r.pins })), 'ok', 6000); return; }
        if (r.busy) { toast(esc(tr('alreadyWorking')), 'ok', 6000); return; } }
      catch (e) { toast(esc(e.message), 'err'); }
    }
    const text = tr('copyText', { dir: S.film.dir === '.' ? S.film.name : S.film.dir, n, file: S.film.review });
    try { await navigator.clipboard.writeText(text); toast(esc(tr(S.claude.listening ? 'copied' : 'notListening')), 'ok', 6000); } catch (e) { toast(esc(text), '', 9000); }
  };
  $('#view-tabs').onclick = e => { const b = e.target.closest('button'); if (b && !b.disabled) setView(b.dataset.v); };
  $('#lightbox').onclick = () => { $('#lightbox').hidden = true; };
  wireBoard();
  $('#pace-undo').onclick = () => paceUndo();
  $('#pace-reset').onclick = () => { paceSnapshot(); S.pace.edits = {}; paceRetime(); paceSave(); };
  $('#bp-close').onclick = () => closeBeatPop();
  $('#bp-reset').onclick = () => { const b = S.data.beats[S.bpIndex]; if (!b) return; paceSnapshot(); delete S.pace.edits[b.key]; paceRetime(); paceSave(); openBeatPop(S.bpIndex, true); };
  $('#bp-slower').onclick = () => paceStep(1 / 1.25);
  $('#bp-faster').onclick = () => paceStep(1.25);
  document.addEventListener('pointerdown', e => { if (!$('#beatpop').hidden && !e.target.closest('#beatpop, .blk.beat')) closeBeatPop(); });
  setInterval(() => { if (!document.hidden) renderClaude(); }, 30000);
  $('#review-list').addEventListener('click', async e => {
    const card = e.target.closest('.pin-card'); if (!card) return;
    const id = card.dataset.id, act = e.target.closest('[data-act]'), p = S.review.pins.find(x => x.id === id);
    if (!act) { if (!e.target.closest('textarea')) selectPin(id, { scroll: false }); return; }
    const a = act.dataset.act;
    if (a === 'toggle') reviewOp({ op: 'update', id, patch: { status: p.status === 'done' ? 'open' : 'done' } });
    if (a === 'del') {
      if (act.dataset.sure) { reviewOp({ op: 'delete', id }); if (S.sel === id) S.sel = null; }
      else { act.dataset.sure = '1'; act.textContent = tr('delSure'); setTimeout(() => { if (act.isConnected) { delete act.dataset.sure; act.textContent = tr('del'); } }, 3000); }
    }
    if (a === 'edit') {
      const box = card.querySelector('.pin-text');
      box.innerHTML = `<textarea>${esc(p.text)}</textarea><div class="edit-actions"><button class="btn ghost small" data-act="edit-cancel">${esc(tr('cancel'))}</button><button class="btn primary small" data-act="edit-save">${esc(tr('save'))}</button></div>`;
      card.querySelector('.pin-top .pin-actions').hidden = true; box.querySelector('textarea').focus();
    }
    if (a === 'edit-save') { const v = card.querySelector('textarea').value.trim(); if (v) reviewOp({ op: 'update', id, patch: { text: v } }); else renderReview(); }
    if (a === 'edit-cancel') renderReview();
  });

  // timeline: drag to scrub; click a comment to go to it; click a beat to edit its pace, drag its right edge to change it
  const inner = $('#tl-inner');
  const tAt = cx => { const r = inner.getBoundingClientRect(); return Math.max(0, Math.min(S.loop - 1e-3, (cx - r.left - PAD) / S.pps)); };
  inner.addEventListener('pointerdown', e => {
    if (!S.ready || e.button !== 0) return;
    const mark = e.target.closest('.tpin');
    if (mark) { selectPin(mark.dataset.id); return; }
    const handle = e.target.closest('.h');
    if (handle && paceEditable()) { e.preventDefault(); return paceDrag(e, +handle.dataset.h, inner); }
    const beatEl = e.target.closest('.blk.beat'), x0 = e.clientX;
    setPlaying(false); inner.setPointerCapture(e.pointerId); seek(tAt(e.clientX));
    const move = ev => seek(tAt(ev.clientX)), up = ev => {
      inner.removeEventListener('pointermove', move); inner.removeEventListener('pointerup', up); inner.removeEventListener('pointercancel', up);
      if (beatEl && ev.type === 'pointerup' && Math.abs(ev.clientX - x0) < 3) openBeatPop(+beatEl.dataset.i);
    };
    inner.addEventListener('pointermove', move); inner.addEventListener('pointerup', up); inner.addEventListener('pointercancel', up);
  });
  inner.addEventListener('dblclick', e => { const b = e.target.closest('.blk'); if (!b) return; const k = b.dataset.tipk, i = +b.dataset.i;
    const t0 = k === 'beat' ? S.data.beats[i].t0 : k === 'cap' ? S.data.caps[i].t0 : null; if (t0 != null) seek(t0 + 1e-3); });
  $('#tl-scroll').addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); const r = inner.getBoundingClientRect(); setZoom(S.zoom * Math.exp(-e.deltaY * 0.01), (e.clientX - r.left - PAD) / S.pps); } }, { passive: false });

  // tooltips
  const tip = $('#tip');
  document.addEventListener('mouseover', e => { const el = e.target.closest('[data-tipk]'); if (!el || e.buttons || !$('#beatpop').hidden) { tip.hidden = true; return; } const h = tipFor(el); if (!h) return; tip.innerHTML = h; tip.hidden = false; });
  document.addEventListener('pointerdown', () => { tip.hidden = true; }, true);
  document.addEventListener('mousemove', e => { if (tip.hidden) return; const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 14) + 'px'; tip.style.top = Math.max(8, e.clientY - h - 12) + 'px'; });

  // render
  $$('#quality button').forEach(b => { b.classList.toggle('on', b.dataset.q === S.quality); b.onclick = () => { S.quality = b.dataset.q; store.set('quality', S.quality); $$('#quality button').forEach(x => x.classList.toggle('on', x === b)); }; });
  $('#render-text').checked = S.rtext; $('#render-text').onchange = e => { S.rtext = e.target.checked; store.set('rtext', S.rtext); };
  $('#render-start').onclick = async () => {
    if (!S.film) return;
    try { onRender(await api('/api/render?id=' + encodeURIComponent(S.film.id), { body: { file: S.file, quality: S.quality, text: S.rtext } }), true); }
    catch (e) { toast(esc(e.message), 'err'); }
  };
  $('#render-cancel').onclick = () => api('/api/render/cancel', { method: 'POST' }).catch(() => {});
  $('#still-btn').onclick = async () => {
    if (!S.film || !S.ready) return; const b = $('#still-btn'); b.disabled = true; b.textContent = tr('stillBusy');
    try { const r = await api('/api/still?id=' + encodeURIComponent(S.film.id), { body: { t: S.t, file: S.file, text: S.rtext } }); S.justRendered = r.out; await refreshFilm();
      toast(`${esc(tr('stillSaved'))} · <a href="/f/${encPath(r.out)}" target="_blank" style="color:var(--accent)">${esc(tr('open'))}</a>`, 'ok', 7000); }
    catch (e) { toast(esc(e.message), 'err'); }
    b.disabled = false; b.textContent = tr('still');
  };
  $('#toasts').addEventListener('click', e => { if (e.target.closest('[data-undo]')) { e.preventDefault(); paceUndo(); } });
  $('#render-list').addEventListener('click', e => { const a = e.target.closest('[data-reveal]'); if (!a) return; e.preventDefault(); api('/api/reveal', { body: { path: a.dataset.reveal } }).catch(() => {}); });

  // keys
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select')) return;
    if (!$('#lightbox').hidden) { $('#lightbox').hidden = true; return; }
    if (S.view === 'board') return;
    if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) { if (S.paceUndo.length) { e.preventDefault(); paceUndo(); } return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); setPlaying(!S.playing); }
    else if (k === 'ArrowLeft') { e.preventDefault(); e.shiftKey ? (setPlaying(false), seek(S.t - 1)) : step(-1); }
    else if (k === 'ArrowRight') { e.preventDefault(); e.shiftKey ? (setPlaying(false), seek(S.t + 1)) : step(1); }
    else if (k === 'Home') { setPlaying(false); seek(0); }
    else if (k === 'End') { setPlaying(false); seek(S.loop - 1 / FPS); }
    else if (k === 'c' || k === 'C') setCommenting(!S.commenting);
    else if (k === 't' || k === 'T') { S.textOn = !S.textOn; applyText(); toast(esc(tr(S.textOn ? 'textOn' : 'textOff')), '', 2200); }
    else if (k === 's' || k === 'S') { S.safeOn = !S.safeOn; renderSafe(); toast(esc(tr(S.safeOn ? 'safeOn' : 'safeOff')), '', 2200); }
    else if (k === '+' || k === '=') setZoom(S.zoom * 1.6);
    else if (k === '-' || k === '_') setZoom(S.zoom / 1.6);
    else if (k === '0') setZoom(1);
    else if (k === 'Escape') { if (!$('#beatpop').hidden) closeBeatPop(); else if (!$('#pop').hidden) closePop(); else if (S.commenting) setCommenting(false); $('#help').hidden = true; }
  });

  window.addEventListener('hashchange', () => {                 // a link or the address bar: #film=<id>&t=<s>&file=<version>
    const h = hash(); if (!h.film || !S.films.length) return;
    if (!S.film || h.film !== S.film.id || (h.file || S.film.html) !== S.file) { if (S.films.some(f => f.id === h.film)) selectFilm(h.film, h.file, +h.t || 0); }
    else if (h.t != null && Math.abs(+h.t - S.t) > 0.02) { setPlaying(false); seek(+h.t); }
  });
  new ResizeObserver(() => { layoutStage(); setTimeout(redraw, 60); }).observe($('#viewer'));
  new ResizeObserver(() => layoutTimeline()).observe($('#tl-scroll'));
}

applyI18n(); renderHelp(); wire(); renderReview(); renderClaude();
loadFilms();
