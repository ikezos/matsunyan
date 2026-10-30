// まつにゃん v3(1枚目: ログイン・管理者の病院の一覧と登録・病院の今日の確認の番号と QR
//              2枚目: 病院の QR から人の登録とその人のカード・飼い主のホーム・猫の登録・病院の確認待ち
//              3枚目の前半: 猫の一覧と詳しい画面・手を挙げる/下ろす・見える範囲を広げる/戻す・引き取る人の印
//              3枚目の後半: アプリの中のメッセージ・急がないボタン・登録の「約束ではない」の文と同意・年1回の確認
//              4枚目: 緊急ボタンと確かめ・管理者の「電話が必要な連絡」と「連絡済み」・病院の「引き受ける/断った」と「引き継ぎ済み」
//              5枚目の前半: 手を挙げた人から病院への返事・電話の形の判定を絞る・緊急のメールの送り直し・つかい方と利用のきまりのページ
//              6枚目: 病院で利用者のカードを作り直す(暗証番号を忘れた・カードをなくした))
// 受け付けは Apps Script(text/plain の JSON を POST)。ログインはログインカード(合言葉の QR + 4けた)と、管理者の Google。
'use strict';
const APP_VER = 7;
const CFG = window.MATSUNYAN_CONFIG || {};
const AUTH_KEY = 'matsunyan.auth', DEV_KEY = 'matsunyan.dev';
const $ = s => document.querySelector(s);
const ERR = {
  card_not_found: 'このカードは使えません。病院か管理者に聞いてください。', wrong_pin: '暗証番号がちがいます。', bad_pin: '暗証番号は4けたの数字です。',
  card_stopped: 'このカードは止まっています。管理者に聞いてください。', hospital_stopped: 'この病院は今は使えません。', pass_invalid: 'もう一度ログインしてください。',
  not_admin: 'この Google のアカウントは管理者ではありません。', not_in_nagoya: '名古屋市内の病院であることを確かめてください。', bad_ward: '区を選んでください。',
  bad_phone: '電話番号の形がちがいます(数字とハイフン・0から始まる10か11けた)。', bad_name: '病院の名前を入れてください(40字まで)。', duplicate: '同じ区に同じ名前の病院があります。',
  already_done: 'この操作はもう済んでいます。', busy: '混み合っています。少し待ってもう一度。', server_not_configured: '受け付けの設定がまだです。',
  wrong_code: '確認の番号がちがいます。病院の人にもう一度聞いてください。', bad_code: '確認の番号は6けたの数字です。', hospital_not_found: 'この QR の病院が見つかりません。',
  bad_nick: '呼び名を入れてください(20字まで)。', nick_contact: '呼び名に電話番号・メール・URL は入れられません。', bad_wants: '飼い主か、引き取ってもよい人かを選んでください。', bad_device: 'この端末ではうまくいきません。画面を開き直してください。',
  too_many_cats: '猫は1人5頭までです(確認待ちを含みます)。', not_owner: '猫を登録できるのは「飼い主」か「両方」で登録した人です。', cat_contact: '猫の欄に電話番号・メール・URL は入れられません。', bad_photo: 'この写真は使えません。別の写真を選んでください。',
  bad_cat_name: '名前を入れてください。', bad_cat_age: '年齢を入れてください。', bad_cat_sex: '性別を選んでください。', bad_cat_color: '毛色を入れてください。', bad_cat_neuter: '不妊手術を選んでください。',
  not_pending: 'この猫はもう確認されています。', cat_not_found: 'この猫は見つかりません。', bad_note: '一言は100字までです。', not_fixable: 'この猫は今は直せません。',
  own_cat: '自分の猫には手を挙げられません。', already_raised: 'もう手を挙げています。', not_raised: 'この猫には手を挙げていません。', not_adopter: '手を挙げられるのは「引き取ってもよい人」か「両方」で登録した人です。',
  not_open: 'この猫は今は手を挙げられません。', bad_marks: '印の選び方がちがいます。', not_user: 'この画面は利用者のカードで使います。',
  need_agree: '「わかりました(同意する)」にチェックを入れてください。', msg_contact: 'メッセージに電話番号・メール・住所・URL は書けません。連絡は病院を通します。', bad_msg: 'メッセージを入れてください(300字まで)。',
  not_allowed: 'このあて先には送れません。', need_renew: '先に「登録を続ける」を押してください。', already_seeking: 'もう引き継ぎ先を探しています。', not_seeking: '今は探していません。',
  sos_not_found: 'この連絡は見つかりません。', not_head: '順番が変わりました。画面を開き直してください。', queue_empty: '順番が尽きました(手を挙げた人がいません)。', already_accepted: 'もう「引き受ける」を記録しています。',
  not_accepted: '先に、先頭の人の「引き受ける」を記録してください。', not_hospital: 'この操作は病院のカードで使います。',
  person_not_found: 'この人は見つかりません(この病院で登録した人だけ作り直せます)。', need_here: '「本人がここにいることを確かめた」にチェックを入れてください。',
  reissue_invalid: 'この QR はもう使えません(15分すぎたか、もう使いました)。病院でもう一度作ってもらってください。', pin_mismatch: '2つの暗証番号がちがいます。',
  token_expired: 'もう一度 Google でログインしてください。', invalid_token: 'もう一度 Google でログインしてください。', network: '通信できませんでした。電波を確かめてもう一度。',
};
const errText = r => r.error === 'too_many' ? '確認の番号を試せる回数をこえました。' + (r.waitMin || 60) + '分ほど待ってから、もう一度。' :
  (ERR[r.error] || ('うまくいきませんでした(' + (r.error || '不明') + ')')) + (r.error === 'wrong_pin' && r.remaining != null ? ' あと' + r.remaining + '回まちがえると止まります。' : '') + (r.error === 'wrong_code' && r.remaining != null ? '(あと' + r.remaining + '回)' : '');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let auth = null;
try { auth = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { auth = null; }
const saveAuth = a => { auth = a; if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a)); else localStorage.removeItem(AUTH_KEY); };
const rid = () => { const b = new Uint8Array(12); crypto.getRandomValues(b); return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); };
function device() { let d = localStorage.getItem(DEV_KEY); if (!d) { d = 'd' + rid(); localStorage.setItem(DEV_KEY, d); } return d; }
const siteUrl = () => CFG.SITE_URL || (location.origin + location.pathname);

async function api(action, data = {}) {
  if (!CFG.GAS_URL) return { ok: false, error: 'server_not_configured' };
  const body = { action, ...data };
  if (auth && auth.type === 'card' && !body.pass) body.pass = auth.pass;
  if (auth && auth.type === 'google' && !body.idToken) body.idToken = auth.idToken;
  try {
    const res = await fetch(CFG.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' });
    return await res.json();
  } catch (e) { return { ok: false, error: 'network' }; }
}
// 押してから返事が来るまでボタンを止める(二度押しの防ぎ)
async function busy(btn, fn) { if (btn.disabled) return; btn.disabled = true; try { return await fn(); } finally { btn.disabled = false; } }
const show = (el, text) => { el.textContent = text; el.classList.toggle('hidden', !text); };

/* ---- 画面の切り替え ---- */
const NAVS = {
  admin: [['admin-sos', '🏠', '連絡'], ['admin-list', '🏥', '病院の一覧'], ['admin-add', '➕', '病院を登録'], ['cats', '🐈', '猫の一覧']],
  hospital: [['hos-home', '🏠', 'ホーム'], ['cats', '🐈', '猫の一覧'], ['msgs', '💬', 'メッセージ'], ['hos-qr', '🔳', '病院のQR']],
  user: [['u-home', '🏠', 'ホーム'], ['u-cat', '➕', '猫を登録'], ['cats', '🐈', '猫の一覧'], ['msgs', '💬', 'メッセージ'], ['u-set', '⚙️', '設定']],   // 両方
  userO: [['u-home', '🏠', 'ホーム'], ['u-cat', '➕', '猫を登録'], ['cats', '🐈', '猫の一覧'], ['msgs', '💬', 'メッセージ']],   // 飼い主だけ
  userA: [['u-home', '🏠', 'ホーム'], ['cats', '🐈', '猫の一覧'], ['msgs', '💬', 'メッセージ'], ['u-set', '⚙️', '設定']],   // 引き取ってもよい人だけ
};
const navOf = w => w === 'adopter' ? 'userA' : w === 'owner' ? 'userO' : 'user';
let navKind = '';
function view(id) {
  document.querySelectorAll('section.view').forEach(s => s.classList.toggle('hidden', s.id !== 'v-' + id));
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === (id === 'cat' ? 'cats' : id)));
  window.scrollTo(0, 0);
  if (id === 'admin-list') loadHospitals();
  if (id === 'admin-sos') loadSos();
  if (id === 'hos-home') loadHospitalHome();
  if (id === 'hos-qr') drawHospitalQr();
  if (id === 'hos-users') loadHosUsers();
  if (id === 'u-home') loadUserHome();
  if (id === 'cats') loadCats();
  if (id === 'u-set') loadSettings();
  if (id === 'msgs') loadMsgs();
  if (id === 'u-cat') { setHeader(fixing ? '猫を直す' : '猫を登録', (auth && auth.nick) || '', true); }
}
function setNav(kind) {
  navKind = kind; const nav = $('#nav');
  nav.innerHTML = ''; nav.classList.toggle('hidden', !kind);
  (NAVS[kind] || []).forEach(([v, ic, t]) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.v = v; b.innerHTML = `<b>${ic}</b>`; b.append(t); b.onclick = () => view(v); nav.appendChild(b); });
}
// 新しいメッセージの数を、下の帯の「メッセージ」に出す
function setBadge(n) { const b = document.querySelector('#nav button[data-v="msgs"]'); if (!b) return; let e = b.querySelector('.badge'); if (!n) { if (e) e.remove(); return; } if (!e) { e = document.createElement('span'); e.className = 'badge'; b.appendChild(e); } e.textContent = n; }
function setHeader(title, who, canLogout) { $('#title').textContent = title; $('#who').textContent = who || ''; $('#logout').classList.toggle('hidden', !canLogout); }

function goLogin(msg) {
  setNav(''); setHeader('まつにゃん', 'ログイン前', false); view('login');
  const card = pendingCard || cardFromHash();
  $('#card-ready').classList.toggle('hidden', !card); $('#card-paste').classList.toggle('hidden', !!card);
  show($('#card-err'), msg || ''); initGoogle();
}
function goAdmin() { setNav('admin'); setHeader('管理者', '管理者', true); fillWards(); view('admin-sos'); }
function goHospital() { setNav('hospital'); setHeader((auth.hospital && auth.hospital.name) || '病院', '病院', true); view('hos-home'); }

/* ---- ログイン ---- */
const cardFromHash = (h = location.hash) => { const m = /[#&]card=([A-Za-z0-9_-]{20,64})/.exec(h); return m ? m[1] : ''; };
let pendingCard = '';
$('#card-go').onclick = () => busy($('#card-go'), async () => {
  const card = pendingCard || cardFromHash() || cardFromHash(String($('#card-url').value || '').trim());
  const pin = String($('#card-pin').value || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).trim();
  if (!card) return show($('#card-err'), 'カードの QR を読むか、カードの URL を入れてください。');
  if (!/^[0-9]{4}$/.test(pin)) return show($('#card-err'), ERR.bad_pin);
  const r = await api('cardLogin', { card, pin });
  if (!r.ok) return show($('#card-err'), errText(r));
  pendingCard = ''; history.replaceState(null, '', location.pathname);   // 合言葉を住所の欄に残さない
  saveAuth({ type: 'card', pass: r.pass, role: r.role, nick: r.nick });
  $('#card-pin').value = '';
  await routeCard();
});
async function routeCard() {
  const w = await api('whoami');
  if (!w.ok) { if (w.error === 'network') { show($('#card-err'), ERR.network); return; } saveAuth(null); return goLogin(errText(w)); }
  auth.role = w.role; auth.hospital = w.hospital; saveAuth(auth);
  if (w.role === 'hospital') return goHospital();
  auth.nick = w.nick; auth.renew = w.renew || null; if (w.wants) auth.wants = w.wants; saveAuth(auth);
  if (w.renew && w.renew.due && !sessionStorage.getItem('matsunyan.renewLater')) return goRenew();   // 年1回の「登録を続けますか」
  return goUser();
}
/* ---- 年1回の確認 ---- */
function renewText(r) { return r.lapsed ? `登録から1年たち、確認が無いまま30日すぎたので、手を挙げた印を今は止めています(消してはいません)。「続ける」を押すと元に戻ります。`
  : `登録(または前の確認)から1年たちました。${r.stopDay} までに確認が無いと、手を挙げた印を止めます(消しません)。`; }
function goRenew() {
  setNav(navOf(auth.wants)); setHeader('登録の確認', auth.nick || '', true); view('renew');
  $('#rn-txt').textContent = renewText(auth.renew || {}); $('#rn-promise').classList.toggle('hidden', auth.wants === 'owner'); show($('#rn-err'), '');
}
$('#rn-go').onclick = () => busy($('#rn-go'), async () => {
  const r = await api('userRenew'); if (!r.ok) return show($('#rn-err'), errText(r));
  auth.renew = r.renew; saveAuth(auth); sessionStorage.removeItem('matsunyan.renewLater'); goUser();
});
$('#rn-later').onclick = () => { sessionStorage.setItem('matsunyan.renewLater', '1'); goUser(); };
function goUser() { setNav(navOf(auth.wants)); setHeader('まつにゃん', auth.nick || '', true); view('u-home'); }
let gsiReady = false;
function initGoogle() {
  if (gsiReady || !CFG.GOOGLE_CLIENT_ID) return;
  const start = () => { if (!window.google || !google.accounts) return; gsiReady = true;
    google.accounts.id.initialize({ client_id: CFG.GOOGLE_CLIENT_ID, callback: onGoogle });
    google.accounts.id.renderButton($('#gsi-btn'), { theme: 'outline', size: 'large', text: 'signin_with', locale: 'ja' }); };
  if (window.google && google.accounts) return start();
  const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = start; document.head.appendChild(s);
}
async function onGoogle(resp) {
  const t = resp && resp.credential; if (!t) return;
  let exp = 0; try { exp = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp; } catch (e) { /* 形が違えば受け付けが断る */ }
  saveAuth({ type: 'google', idToken: t, exp });
  const w = await api('whoami');
  if (!w.ok || w.role !== 'admin') { saveAuth(null); goLogin(); return show($('#admin-err'), errText(w.ok ? { error: 'not_admin' } : w)); }
  goAdmin();
}
$('#logout').onclick = async () => {
  if (!confirm('ログアウトしますか?')) return;
  if (auth && auth.type === 'card') await api('logout');
  if (auth && auth.type === 'google' && window.google && google.accounts) google.accounts.id.disableAutoSelect();
  saveAuth(null); goLogin();
};
function adminExpired(r) { if (['token_expired', 'invalid_token', 'bad_token', 'not_admin'].includes(r.error)) { saveAuth(null); goLogin(); show($('#admin-err'), errText(r)); return true; } return false; }

/* ---- 管理者: 病院 ---- */
let wards = ['千種区', '東区', '北区', '西区', '中村区', '中区', '昭和区', '瑞穂区', '熱田区', '中川区', '港区', '南区', '守山区', '緑区', '名東区', '天白区'];
function fillWards() { const s = $('#h-ward'); if (s.options.length) return; s.add(new Option('選んでください', '')); wards.forEach(w => s.add(new Option(w, w))); }
async function loadHospitals() {
  const box = $('#h-list'); show($('#list-err'), '');
  const r = await api('adminHospitalList');
  if (!r.ok) { if (!adminExpired(r)) show($('#list-err'), errText(r)); return; }
  $('#h-count').textContent = r.hospitals.length + '件'; box.innerHTML = '';
  if (!r.hospitals.length) box.innerHTML = '<div class="card"><div class="note" style="margin:0">まだ病院がありません。下の「病院を登録」から入れます。</div></div>';
  r.hospitals.forEach(h => box.appendChild(hospitalCard(h)));
}
function hospitalCard(h) {
  const d = document.createElement('div'); d.className = 'card'; d.dataset.id = h.id;
  if (h.stopped) d.style.opacity = '.7';
  const t = (cls, s) => { const e = document.createElement('span'); e.className = 'tag ' + cls; e.textContent = s; return e; };
  const name = document.createElement('div'); name.className = 'big'; name.style.fontSize = '18px'; name.textContent = h.name;
  const ward = document.createElement('div'); ward.className = 'note'; ward.style.margin = '0'; ward.textContent = '名古屋市 ' + h.ward + ' ・ 登録 ' + String(h.createdAt).slice(0, 10);
  const tel = document.createElement('div'); tel.className = 'tel'; tel.textContent = '☎ ' + h.phone;
  const tags = document.createElement('div'); tags.append(h.stopped ? t('r', '止めています') : t('g', '使えます'));
  if (/5回/.test(h.cardState)) tags.append(t('r', 'カードが止まっています'));
  const btns = document.createElement('div'); btns.style.textAlign = 'right';
  const stop = document.createElement('button'); stop.type = 'button'; stop.className = 'btn sm' + (h.stopped ? '' : ' sub'); stop.textContent = h.stopped ? '使えるように戻す' : '止める';
  stop.dataset.act = 'stop';
  const reqStop = rid();
  stop.onclick = () => busy(stop, async () => {
    if (!confirm(h.stopped ? h.name + ' を使えるように戻しますか?' : h.name + ' を止めますか?\n止めると、病院の人は入れなくなり、確認の番号も使えなくなります。')) return;
    const r = await api('adminHospitalStop', { reqId: reqStop, hospitalId: h.id, stopped: !h.stopped });
    if (!r.ok && r.error !== 'already_done') { if (!adminExpired(r)) alert(errText(r)); return; }
    loadHospitals();
  });
  const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn sm sub'; reset.textContent = 'カードを作り直す'; reset.dataset.act = 'reset';
  const reqReset = rid();
  reset.onclick = () => busy(reset, async () => {
    const pin = prompt(h.name + ' のカードを作り直します。前のカードは使えなくなります。\n新しい暗証番号(4けた)を入れてください。');
    if (pin == null) return; if (!/^[0-9]{4}$/.test(pin)) return alert(ERR.bad_pin);
    const r = await api('adminCardReset', { reqId: reqReset, hospitalId: h.id, pin });
    if (!r.ok) { if (!adminExpired(r)) alert(errText(r)); return; }
    view('admin-add'); showCard(h.name, r.card);
  });
  btns.append(stop, reset);
  d.append(tags, name, ward, tel, btns);
  return d;
}
let addReq = rid();
$('#add-go').onclick = () => busy($('#add-go'), async () => {
  const hospital = { name: $('#h-name').value.trim(), ward: $('#h-ward').value, phone: $('#h-phone').value.trim(), inNagoya: $('#h-nagoya').checked };
  const pin = $('#h-pin').value.trim();
  if (!hospital.name) return show($('#add-err'), ERR.bad_name);
  if (!hospital.ward) return show($('#add-err'), ERR.bad_ward);
  if (!hospital.inNagoya) return show($('#add-err'), ERR.not_in_nagoya);
  if (!/^[0-9]{4}$/.test(pin)) return show($('#add-err'), ERR.bad_pin);
  show($('#add-err'), '');
  const r = await api('adminHospitalAdd', { reqId: addReq, hospital, pin });
  if (!r.ok) { if (!adminExpired(r)) show($('#add-err'), errText(r)); return; }
  addReq = rid();   // 次の登録は新しい操作ID
  ['#h-name', '#h-phone', '#h-pin'].forEach(s => { $(s).value = ''; }); $('#h-ward').value = ''; $('#h-nagoya').checked = false;
  showCard(r.hospital.name, r.card);
});
function showCard(name, card) {
  const url = siteUrl() + '#card=' + card;
  $('#add-form').classList.add('hidden'); $('#card-out').classList.remove('hidden');
  $('#card-out-name').textContent = name; $('#card-out-url').textContent = url;
  QR.draw($('#card-qr'), url, { ecl: 'M', scale: 6 });
}
$('#card-print').onclick = () => window.print();
$('#card-done').onclick = () => { $('#card-out').classList.add('hidden'); $('#add-form').classList.remove('hidden'); $('#card-qr').width = 0; $('#card-out-url').textContent = ''; view('admin-list'); };

/* ---- 病院 ---- */
async function loadHospitalHome() {
  show($('#hos-err'), '');
  const r = await api('hospitalHome');
  if (!r.ok) { if (r.error === 'network') return show($('#hos-err'), ERR.network); saveAuth(null); return goLogin(errText(r)); }
  const [y, m, d] = r.day.split('-').map(Number);
  $('#code-label').textContent = `今日の確認の番号(${m}月${d}日)`; $('#code').textContent = r.code;
  $('#hos-info').textContent = '名古屋市 ' + r.hospital.ward + ' ・ ☎ ' + r.hospital.phone;
  auth.hospital = { id: r.hospital.id, name: r.hospital.name, ward: r.hospital.ward }; saveAuth(auth);
  $('#title').textContent = r.hospital.name;
  $('#hos-counts').textContent = `登録した猫 ${r.counts.cats}頭 ・ 登録した人 ${r.counts.people}人`;
  $('#hos-pend-n').textContent = r.pending.length + '件';
  setBadge(r.unread);
  $('#hos-sos').onclick = () => r.sosCats.length ? openSos(r.sosCats, r.hospital.name) : show($('#hos-err'), '登録済みの猫がいないので、緊急ボタンは使えません。');
  $('#hos-renew').textContent = `登録の確認待ちの人 ${r.renewWaiting}人(1年たって、まだ「続ける」を押していない人)`;
  $('#hos-seek-box').classList.toggle('hidden', !r.seeking.length); $('#hos-seek-n').textContent = r.seeking.length + '頭';
  $('#hos-seek').innerHTML = r.seeking.map(c => `<div class="row lcard" data-seekcat="${esc(c.id)}"><div class="grow"><span class="big">${esc(c.name)}</span> <span class="note">飼い主 ${esc(c.ownerNick)} ・ ${esc(dayText(c.since))}から</span></div></div>`).join('');
  document.querySelectorAll('#hos-seek [data-seekcat]').forEach(e => { e.onclick = () => openCat(e.dataset.seekcat); });
  const box = $('#hos-pend'); box.innerHTML = ''; photoUrls.forEach(u => URL.revokeObjectURL(u)); photoUrls = [];
  if (!r.pending.length) box.innerHTML = '<div class="note" style="margin:0">今は確認待ちの猫はいません。</div>';
  r.pending.forEach(c => {
    const d = document.createElement('div'); d.dataset.cat = c.id; d.style.marginBottom = '12px';
    d.innerHTML = `<div class="cat"><div class="ph">🐱</div><div class="grow"><div class="big">${esc(c.name)}</div><div class="note" style="margin:2px 0">${esc([c.age, c.sex].filter(Boolean).join(' ・ '))} ・ 飼い主 ${esc(c.ownerNick)}</div></div></div>`
      + `<div class="note">${esc(['毛色 ' + c.color, c.nature && '性格 ' + c.nature, c.illness && '持病 ' + c.illness, c.vaccine && 'ワクチン ' + c.vaccine, '不妊手術 ' + c.neuter].filter(Boolean).join(' / '))}</div>`
      + `<div class="btn2"><button class="btn" type="button" data-ok="1">確認して登録</button><button class="btn sub" type="button" data-ok="0">直してもらう</button></div>`;
    if (c.hasPhoto) catPhotoInto(d.querySelector('.ph'), c.id);
    d.querySelectorAll('[data-ok]').forEach(b => { b.onclick = () => busy(b, async () => {
      const yes = b.dataset.ok === '1'; let note = '';
      if (yes) { if (!confirm(c.name + ' を確認して登録しますか?\n登録すると、ほかの利用者にも見えるようになります。')) return; }
      else { note = prompt(c.name + ' を飼い主に直してもらいます。\n直してほしい所を一言(なくてもよい・100字まで)'); if (note == null) return; }
      const res = await api('hospitalCatCheck', { catId: c.id, ok: yes, note: note.trim() });
      if (!res.ok && res.error !== 'not_pending') return alert(errText(res));
      loadHospitalHome();
    }); });
    box.appendChild(d);
  });
}
/* ---- 病院: 利用者のカードを作り直す(6枚目) ---- */
$('#hos-users-go').onclick = () => view('hos-users');
$('#hu-search').onclick = () => loadHosUsers();
$('#hu-q').onkeydown = e => { if (e.key === 'Enter') loadHosUsers(); };
async function loadHosUsers() {
  show($('#hu-err'), ''); setHeader('カードを作り直す', '病院', true);
  const q = $('#hu-q').value.trim(), r = await api('hospitalUserList', { q });
  if (!r.ok) return show($('#hu-err'), errText(r));
  $('#hu-count').textContent = (q ? `「${q}」で ${r.people.length}人` : `${r.people.length}人`) + ` ・ この病院の利用者 ${r.total}人` + (r.more ? '(多いので呼び名で絞ってください)' : '');
  const box = $('#hu-list'); box.innerHTML = '';
  if (!r.people.length) box.innerHTML = '<div class="card"><div class="note" style="margin:0">見つかりません。</div></div>';
  r.people.forEach(p => {
    const d = document.createElement('div'); d.className = 'card lcard'; d.dataset.person = p.id;
    d.innerHTML = `<div class="row"><div class="grow"><span class="big">${esc(p.nick)}</span> <span class="note">${esc({ owner: '飼い主', adopter: '引き取ってもよい人', both: '両方' }[p.wants])}</span>`
      + `<div class="note" style="margin:2px 0 0">登録 ${esc(p.createdAt)}${p.lastUsed ? ' ・ 最後に使った日 ' + esc(p.lastUsed) : ''}${p.reissuedAt ? ' ・ 作り直し ' + esc(p.reissuedAt) : ''}</div></div>`
      + `<span class="tag ${p.state === '使える' ? 'g' : 'r'}">${esc(p.state === '使える' ? 'カード使える' : 'カード止まっている')}</span></div>`;
    d.onclick = () => openReissue(p);
    box.appendChild(d);
  });
}
let reissueReq = rid();
function openReissue(p) {
  view('hos-reissue'); reissueReq = rid();
  $('#hr-ask').classList.remove('hidden'); $('#hr-out').classList.add('hidden'); $('#hr-here').checked = false; show($('#hr-err'), '');
  $('#hr-nick').textContent = p.nick; $('#hr-meta').textContent = '登録 ' + p.createdAt + ' ・ ' + p.state;
  $('#hr-go').onclick = () => busy($('#hr-go'), async () => {
    if (!$('#hr-here').checked) return show($('#hr-err'), ERR.need_here);
    if (!confirm(p.nick + ' さんのカードを作り直しますか?\n前のカードはすぐに使えなくなります。')) return;
    const r = await api('hospitalReissueStart', { reqId: reissueReq, personId: p.id, here: true });
    if (!r.ok) { if (r.error !== 'network') reissueReq = rid(); return show($('#hr-err'), errText(r)); }
    $('#hr-ask').classList.add('hidden'); $('#hr-out').classList.remove('hidden');
    $('#hr-min').textContent = r.min; $('#hr-out-nick').textContent = r.nick + ' さん';
    QR.draw($('#hr-qr'), siteUrl() + '#re=' + r.ticket, { ecl: 'M', scale: 6 });
  });
}
$('#hr-back').onclick = () => view('hos-users');
$('#hr-done').onclick = () => { $('#hr-qr').width = 0; view('hos-users'); };
/* ---- 作り直しの QR を読んだ人(本人のスマホ): 新しい暗証番号 → 新しいカード ---- */
let reTicket = '', reFinishReq = rid();
async function goReissue(t) {
  setNav(''); setHeader('カードの作り直し', '作り直し', false); view('reissue'); reTicket = t; show($('#ri-err'), '');
  const r = await api('reissueInfo', { ticket: t });
  $('#ri-name').textContent = r.ok ? r.nick + ' さん' : errText(r); $('#ri-hos').textContent = r.ok ? 'かかりつけ: ' + r.hospital.name : '';
  ['#ri-form', '#ri-go'].forEach(s => $(s).classList.toggle('hidden', !r.ok));
}
$('#ri-go').onclick = () => busy($('#ri-go'), async () => {
  const pin = half($('#ri-pin').value), pin2 = half($('#ri-pin2').value);
  if (!/^[0-9]{4}$/.test(pin)) return show($('#ri-err'), ERR.bad_pin);
  if (pin !== pin2) return show($('#ri-err'), ERR.pin_mismatch);
  show($('#ri-err'), '');
  const r = await api('reissueFinish', { ticket: reTicket, pin, reqId: reFinishReq });
  if (!r.ok) return show($('#ri-err'), errText(r));
  reTicket = ''; reFinishReq = rid(); $('#ri-pin').value = ''; $('#ri-pin2').value = '';
  saveAuth(null); showUserCard(r); setHeader('作り直しました', r.nick, false);
});
function drawHospitalQr() {
  const h = auth && auth.hospital; if (!h || !h.id) return;
  QR.draw($('#hos-qr'), siteUrl() + '#h=' + h.id, { ecl: 'M', scale: 6 });
  $('#hos-qr-name').textContent = h.name;
}
$('#hos-print').onclick = () => window.print();

/* ---- QR を読んだ人: 病院で登録 → その人のカード ---- */
let regHospital = '', regReq = rid();
const half = s => String(s || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\s/g, '');
async function goHospitalReg(id) {
  setNav(''); setHeader('病院で登録', '登録前', false); view('hreg'); regHospital = id;
  const r = await api('hospitalPublic', { hospitalId: id });
  $('#hreg-name').textContent = r.ok ? r.hospital.name + ' で登録' : errText(r);
  $('#hreg-ward').textContent = r.ok ? '名古屋市 ' + r.hospital.ward : '';
  ['#hreg-form', '#hreg-privacy', '#hreg-go'].forEach(s => $(s).classList.toggle('hidden', !r.ok));
}
// 電話の形(受け付けの looksPhone_ と同じ決まり): 0 から始まる10〜11けた・+81 の形。「2026-11-03」「10歳」は通す
const looksPhone = s => /(^|[^0-9+])(?:\+81[-\s]{0,3}(?:0[-\s]{0,3})?[1-9](?:[-\s]{0,3}[0-9]){8,9}|0(?:[-\s]{0,3}[0-9]){9,10})(?![0-9])/.test(String(s).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[－‐―ー−]/g, '-').replace(/＋/g, '+').replace(/[()（）\s　]/g, ' '));
$('#hreg-go').onclick = () => busy($('#hreg-go'), async () => {
  const nick = $('#r-nick').value.trim(), code = half($('#r-code').value), pin = half($('#r-pin').value), w = document.querySelector('input[name=wants]:checked');
  if (!nick) return show($('#hreg-err'), ERR.bad_nick);
  if (/[@＠]/.test(nick) || looksPhone(nick)) return show($('#hreg-err'), ERR.nick_contact);   // 受け付けでも同じく断る
  if (!/^[0-9]{6}$/.test(code)) return show($('#hreg-err'), ERR.bad_code);
  if (!w) return show($('#hreg-err'), ERR.bad_wants);
  if (w.value !== 'owner' && !$('#r-agree').checked) return show($('#hreg-err'), ERR.need_agree);   // 受け付けでも断る
  if (!/^[0-9]{4}$/.test(pin)) return show($('#hreg-err'), ERR.bad_pin);
  show($('#hreg-err'), '');
  const marks = w.value === 'owner' ? undefined : { foster: $('#r-foster').checked, life: $('#r-life').checked };
  const r = await api('userRegister', { hospitalId: regHospital, code, dev: device(), nick, wants: w.value, pin, reqId: regReq, marks, agree: w.value !== 'owner' ? true : undefined });
  if (!r.ok) { if (r.error !== 'network') regReq = rid(); return show($('#hreg-err'), errText(r)); }
  regReq = rid(); $('#r-pin').value = ''; $('#r-code').value = '';
  showUserCard(r);
});
// 選んだ役に合わせて、印の欄と「約束ではない」の文を出す(引き取ってもよい人・両方は同意のチェックが要る)
document.querySelectorAll('input[name=wants]').forEach(i => { i.onchange = () => { if (!i.checked) return;
  $('#r-marks').classList.toggle('hidden', i.value === 'owner'); $('#r-agree-box').classList.toggle('hidden', i.value === 'owner'); $('#r-owner-note').classList.toggle('hidden', i.value === 'adopter'); }; });
function showUserCard(r) {
  const url = siteUrl() + '#card=' + r.card;
  pendingCard = r.card;   // 「このカードで入る」で使う。住所の欄には出さない
  setHeader('登録できました', r.nick, false); view('ucard');
  $('#ucard-nick').textContent = r.nick + ' さんのカード'; $('#ucard-hos').textContent = 'かかりつけ: ' + r.hospital.name;
  $('#ucard-url').textContent = url; QR.draw($('#ucard-qr'), url, { ecl: 'M', scale: 6 });
}
$('#ucard-print').onclick = () => window.print();
$('#ucard-go').onclick = () => { $('#ucard-qr').width = 0; $('#ucard-url').textContent = ''; goLogin(); };

/* ---- 利用者: ホーム・猫の登録 ---- */
const SEEK_TAG = '<span class="tag r" data-seek="1">引き継ぎ先を探しています</span>';
$('#u-renew-go').onclick = () => goRenew();
const STATE_TAG = { '登録済み': ['g', '登録済み'], '確認待ち': ['r', '病院の確認待ち'], '直してもらう': ['r', '直してもらう'], '引き継ぎ済み': ['', '引き継ぎ済み'] };
let photoUrls = [];
async function catPhotoInto(el, id) {
  const r = await api('catPhoto', { catId: id }); if (!r.ok) return;
  const b = Uint8Array.from(atob(r.data), c => c.charCodeAt(0)), u = URL.createObjectURL(new Blob([b], { type: 'image/jpeg' })); photoUrls.push(u);
  el.innerHTML = ''; const i = new Image(); i.src = u; i.alt = '猫の写真'; el.appendChild(i);
}
const catSub = c => [c.age, c.sex, c.color].filter(Boolean).join(' ・ ');
async function loadUserHome() {
  show($('#u-err'), '');
  const r = await api('userHome');
  if (!r.ok) { if (r.error === 'network') return show($('#u-err'), ERR.network); saveAuth(null); return goLogin(errText(r)); }
  if (auth.wants !== r.wants) { auth.wants = r.wants; saveAuth(auth); setNav(navOf(r.wants)); document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === 'u-home')); }
  setHeader('まつにゃん', r.nick, true);
  $('#u-line').textContent = r.nick + ' さん ・ かかりつけ: ' + (r.hospital ? r.hospital.name : '');
  photoUrls.forEach(u => URL.revokeObjectURL(u)); photoUrls = [];
  const live = r.cats.filter(c => c.state !== '引き継ぎ済み');
  $('#u-sos').classList.toggle('hidden', !live.length);   // 緊急ボタン: 自分の猫(引き継ぎ済みでない)がいる時だけ
  $('#u-sos').onclick = () => openSos(live.map(c => ({ id: c.id, name: c.name, hospital: c.hospital })), r.hospital ? r.hospital.name : '');
  $('#u-cats-title').textContent = `わたしの猫(${live.length}頭)`;
  const box = $('#u-cats'); box.innerHTML = '';
  if (!r.cats.length) box.innerHTML = `<div class="card"><div class="note" style="margin:0">${r.wants === 'adopter' ? 'まだ猫はいません。' : 'まだ猫を登録していません。下の「猫を登録」から入れます(' + r.max + '頭まで)。'}</div></div>`;
  auth.renew = r.renew || null; saveAuth(auth);
  $('#u-renew').classList.toggle('hidden', !(r.renew && r.renew.due)); if (r.renew && r.renew.due) $('#u-renew-txt').textContent = renewText(r.renew);
  setBadge(r.unread); show($('#u-unread'), r.unread ? `新しい ${r.unread}件` : '');
  const mb = $('#u-msgs'); mb.innerHTML = ''; if (!r.msgs.length) mb.innerHTML = '<div class="note" style="margin:0">まだメッセージはありません。</div>'; r.msgs.forEach(m => mb.appendChild(msgCard(m)));
  r.cats.forEach(c => {
    const d = document.createElement('div'); d.className = 'card'; d.dataset.cat = c.id; const [cls, txt] = STATE_TAG[c.state] || ['', c.state];
    d.innerHTML = `<div class="cat"><div class="ph">🐱</div><div class="grow"><div class="big">${esc(c.name)}</div><div class="note" style="margin:2px 0">${esc(catSub(c))}</div><span class="tag ${cls}" data-state="${esc(c.state)}">${esc(txt)}</span>${c.state === '登録済み' ? `<span class="tag">手を挙げた人 ${c.raised}人</span>` + (c.wide ? '<span class="tag">ほかの病院にも見せる</span>' : '') + (c.seeking ? SEEK_TAG : '') : ''}</div></div>`
      + (c.state === '直してもらう' ? `<div class="fixnote">病院から: ${esc(c.note || '直してほしい所があります')}</div><button class="btn sm" type="button" data-fix="1">直して送る</button>` : '');
    if (c.hasPhoto) catPhotoInto(d.querySelector('.ph'), c.id);
    const fb = d.querySelector('[data-fix]'); if (fb) fb.onclick = () => startFix(c);
    if (c.state === '登録済み') { d.classList.add('lcard'); d.onclick = () => openCat(c.id); }
    box.appendChild(d);
  });
}
let catReq = rid(), catPhoto = '', fixing = '';
const CAT_KEYS = ['name', 'age', 'sex', 'color', 'nature', 'illness', 'vaccine', 'neuter'];
function clearCatForm() { CAT_KEYS.forEach(k => { $('#c-' + k).value = ''; }); catPhoto = ''; fixing = ''; $('#c-ph').innerHTML = '<span>📷</span>'; $('#c-go').textContent = '病院に送る'; }
function startFix(c) { clearCatForm(); CAT_KEYS.forEach(k => { $('#c-' + k).value = c[k] || ''; }); fixing = c.id; $('#c-go').textContent = '直して病院に送る'; view('u-cat'); }
// 写真: canvas に描き直して JPEG にする(撮影場所などの付属情報は落ちる)。長辺 1024px
async function cleanImage(file, side = 1024, quality = 0.8) {
  let src, w, h;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); w = src.width; h = src.height; }
  catch { src = await new Promise((ok, ng) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = ng; i.src = u; }); w = src.naturalWidth; h = src.naturalHeight; }
  const s = Math.min(1, side / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.round(w * s); c.height = Math.round(h * s); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality).replace(/^data:image\/jpeg;base64,/, '');
}
$('#c-photo').onchange = async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  try { catPhoto = await cleanImage(f); $('#c-ph').innerHTML = ''; const i = new Image(); i.src = 'data:image/jpeg;base64,' + catPhoto; i.alt = '入れた写真'; $('#c-ph').appendChild(i); show($('#c-err'), ''); }
  catch { show($('#c-err'), ERR.bad_photo); }
};
$('#c-go').onclick = () => busy($('#c-go'), async () => {
  const cat = {}; CAT_KEYS.forEach(k => { cat[k] = $('#c-' + k).value.trim(); });
  for (const k of ['name', 'age', 'sex', 'color', 'neuter']) if (!cat[k]) return show($('#c-err'), ERR['bad_cat_' + k]);
  show($('#c-err'), '');
  const r = await api('catAdd', { reqId: catReq, cat, photo: catPhoto, ...(fixing ? { catId: fixing } : {}) });
  if (!r.ok && r.error !== 'already_done') { if (r.error !== 'network') catReq = rid(); return show($('#c-err'), errText(r)); }
  catReq = rid(); clearCatForm(); view('u-home');
});

/* ---- 猫の一覧・詳しい画面(見本 4・5)・設定 ---- */
const isUser = () => auth && auth.type === 'card' && auth.role === 'user';
const canAdopt = () => isUser() && auth.wants !== 'owner';
const dayText = t => { const m = /^\d{4}-(\d\d)-(\d\d)/.exec(t || ''); return m ? `${+m[1]}月${+m[2]}日` : ''; };
const hosText = h => h ? `${h.ward} ${h.name}` : '';
function seeErr(r, box) {   // 一覧・詳しい画面の誤り。管理者の期限切れ・通行証の切れはログインへ
  if (auth && auth.type === 'google') { if (adminExpired(r)) return; }
  else if (['pass_invalid', 'card_stopped', 'hospital_stopped'].includes(r.error)) { saveAuth(null); return goLogin(errText(r)); }
  show(box, errText(r));
}
async function loadCats() {
  show($('#l-err'), ''); setHeader('猫の一覧', auth.type === 'google' ? '管理者' : auth.role === 'hospital' ? '病院' : (auth.nick || ''), true);
  const r = await api('catList');
  if (!r.ok) return seeErr(r, $('#l-err'));
  $('#l-line').innerHTML = isUser() ? (canAdopt() ? `いま手を挙げている猫: <b>${r.raising}頭</b> ・ 見える猫 ${r.cats.length}頭` : `見える猫 ${r.cats.length}頭`)
    : `${auth.type === 'google' ? '登録済みの猫(全部)' : 'この病院の登録済みの猫'}: <b>${r.cats.length}頭</b>`;
  photoUrls.forEach(u => URL.revokeObjectURL(u)); photoUrls = [];
  const box = $('#l-cats'); box.innerHTML = '';
  if (!r.cats.length) box.innerHTML = '<div class="card"><div class="note" style="margin:0">今は見られる猫がいません。</div></div>';
  r.cats.forEach(c => {
    const d = document.createElement('div'); d.className = 'card lcard'; d.dataset.cat = c.id;
    const tag = c.own ? '<span class="tag">あなたの猫</span>' : c.mine ? `<span class="tag g">あなたは${c.myOrder}番目</span>` : '';
    const btn = c.own || !canAdopt() ? '' : c.mine ? '<button class="btn sm sub" type="button" data-q="lower">手を下ろす</button>' : '<button class="btn sm" type="button" data-q="raise">手を挙げる</button>';
    d.innerHTML = `<div class="cat"><div class="ph">🐱</div><div class="grow"><div class="big">${esc(c.name)}</div><div class="note" style="margin:0">${esc(catSub(c))}</div><div class="note" style="margin:0">${esc(hosText(c.hospital))}</div></div></div>`
      + `<div class="row"><div class="grow"><span class="tag" data-raised="${c.raised}">手を挙げた人 ${c.raised}人</span>${tag}${c.wide ? '<span class="tag">ほかの病院にも見せる</span>' : ''}${c.seeking ? SEEK_TAG : ''}</div>${btn}</div>`;
    if (c.hasPhoto) catPhotoInto(d.querySelector('.ph'), c.id);
    d.onclick = ev => { if (!ev.target.closest('button')) openCat(c.id); };
    const qb = d.querySelector('[data-q]'); if (qb) qb.onclick = () => busy(qb, async () => {
      const up = qb.dataset.q === 'raise';
      if (!up && !confirm(c.name + ' の手を下ろしますか?\nもう一度挙げると、いちばん後ろになります。')) return;
      const res = await api(up ? 'queueRaise' : 'queueLower', { catId: c.id });
      if (!res.ok && !['already_raised', 'not_raised'].includes(res.error)) return alert(errText(res));
      loadCats();
    });
    box.appendChild(d);
  });
}
let openId = '';
async function openCat(id) { openId = id; view('cat'); await loadCat(); }
async function loadCat() {
  show($('#d-err'), ''); ['#d-scope', '#d-queue', '#d-me', '#d-seek', '#d-msg', '#d-decide', '#d-sos'].forEach(s => $(s).classList.add('hidden')); show($('#d-msg-ok'), '');
  const r = await api('catDetail', { catId: openId });
  if (!r.ok) { $('#d-name').textContent = ''; return seeErr(r, $('#d-err')); }
  const c = r.cat;
  setHeader(c.name, c.own ? (auth.nick || '') + '(飼い主)' : auth.type === 'google' ? '管理者' : auth.role === 'hospital' ? '病院' : (auth.nick || ''), true);
  $('#d-name').textContent = c.name; $('#d-sub').textContent = catSub(c);
  const tg = []; if (c.vaccine) tg.push(['g', 'ワクチン' + c.vaccine]); tg.push([c.neuter === '済み' ? 'g' : '', '不妊手術' + c.neuter]);
  if (c.state !== '登録済み') tg.push(['r', STATE_TAG[c.state] ? STATE_TAG[c.state][1] : c.state]);
  if (c.seeking) tg.push(['r', '引き継ぎ先を探しています']);
  $('#d-tags').innerHTML = tg.map(([k, t]) => `<span class="tag ${k}">${esc(t)}</span>`).join('');
  const ph = $('#d-head .ph'); ph.innerHTML = '🐱'; if (c.hasPhoto) catPhotoInto(ph, c.id);
  $('#d-info').innerHTML = [['性格', c.nature || '—'], ['持病', c.illness || '—'], ['病院', hosText(c.hospital)]].concat(c.ownerNick != null ? [['飼い主', c.ownerNick]] : []).map(([k, v]) => `${k}: ${esc(v)}`).join('<br>');
  if (c.own) {   // 見える範囲: 飼い主だけが変えられる
    $('#d-scope').classList.remove('hidden');
    $('#d-scope-now').textContent = c.wide ? '今は、ほかの病院の登録者にも見えています。' : '今は、同じ病院の登録者にだけ見えています。';
    const b = $('#d-wide'); b.textContent = c.wide ? '同じ病院の人だけに戻す' : 'ほかの病院の人にも見せる'; b.className = 'btn sm' + (c.wide ? ' sub' : '');
    b.onclick = () => busy(b, async () => {
      if (!confirm(c.wide ? '同じ病院の登録者だけに戻しますか?\n(もう手を挙げている人の順番は残ります)' : 'ほかの病院の登録者にも見せますか?\nいつでも戻せます。')) return;
      const res = await api('catWide', { catId: c.id, wide: !c.wide }); if (!res.ok) return show($('#d-err'), errText(res)); loadCat(); });
  }
  if (c.own && c.state === '登録済み') {   // 急がないボタン: 飼い主だけ。緊急ボタン(管理者へ電話の流れ)とは別
    $('#d-seek').classList.remove('hidden');
    $('#d-seek-now').textContent = c.seeking ? '今は「引き継ぎ先を探しています」と出ています。病院に知らせてあります。' : '急ぎではないけれど、この先を考えて引き継ぎ先を探したい時に押します。病院にメッセージで知らせます。';
    const b = $('#d-seek-btn'); b.textContent = c.seeking ? '探すのをやめる(取り消す)' : '引き継ぎ先を探したい(急がない)'; b.className = 'btn sm' + (c.seeking ? ' sub' : '');
    b.onclick = () => busy(b, async () => {
      if (!confirm(c.seeking ? '引き継ぎ先さがしを取り消しますか?\n病院にも取り消しを知らせます。' : c.name + ' の引き継ぎ先を探したい(急がない)、と病院に知らせますか?\n猫に「引き継ぎ先を探しています」の印が付きます。いつでも取り消せます。')) return;
      const res = await api('catSeek', { catId: c.id, on: !c.seeking }); if (!res.ok && !['already_seeking', 'not_seeking'].includes(res.error)) return show($('#d-err'), errText(res)); loadCat(); });
  }
  if (c.canMsg || c.canReply) {   // メッセージ: 飼い主→病院・病院→飼い主/手を挙げている人・手を挙げた人→病院(返事・5枚目)。受け付けも同じ決まりで断る
    $('#d-msg').classList.remove('hidden'); $('#d-msg-h').textContent = c.canReply ? '病院へ返事する' : 'メッセージを送る';
    const sel = $('#d-msg-to'); sel.innerHTML = '';
    if (c.canReply) sel.add(new Option('病院(' + hosText(c.hospital) + ')', 'hospital'));
    else if (c.own) sel.add(new Option('病院(' + hosText(c.hospital) + ')', 'hospital'));
    else { sel.add(new Option('飼い主 ' + (c.ownerNick || ''), 'owner')); (c.queue || []).forEach(q => { if (q.qid) sel.add(new Option(`手を挙げた ${q.order}番目 ${q.nick}`, 'queue:' + q.qid)); }); }
  }
  if (c.queue) {   // 順番の一覧: 飼い主・病院・管理者だけ(受け付けが、ほかの人には送らない)
    $('#d-queue').classList.remove('hidden');
    $('#d-qlist').innerHTML = c.queue.length ? c.queue.map(q => `<div class="row qrow" data-order="${q.order}"><div class="ord">${q.order}</div><div class="grow"><span class="big">${esc(q.nick)}</span> <span class="note">${esc(dayText(q.at))}</span><br>`
      + (q.foster ? '<span class="tag g">一時預かりできる</span>' : '') + (q.life ? '<span class="tag g">終生飼養できる</span>' : '') + (!q.foster && !q.life ? '<span class="tag">印なし</span>' : '') + '</div></div>').join('')
      : '<div class="note" style="margin:0">まだ手を挙げた人はいません。</div>';
  }
  if (c.canSos) { $('#d-sos').classList.remove('hidden'); $('#d-sos').onclick = () => openSos([{ id: c.id, name: c.name }], c.hospital ? c.hospital.name : ''); }
  if (c.canDecide) {   // 病院: 先頭の人の「引き受ける/断った」と「引き継ぎ済み」
    $('#d-decide').classList.remove('hidden');
    const head = (c.queue || [])[0];
    $('#d-decide-btns').classList.toggle('hidden', !head || head.accepted); $('#d-handover').classList.toggle('hidden', !head || !head.accepted);
    $('#d-decide-now').textContent = !head ? '並んでいる人はいません(順番が尽きたか、引き継ぎで閉じました)。' : head.accepted ? `1番目の ${head.nick} さんが引き受けると記録しました。引き継ぎが済んだら「引き継ぎ済みにする」を押します。`
      : `1番目の ${head.nick} さんに、病院から(アプリのメッセージで)聞いて、答えを記録します。`;
    const dec = (btn, decision) => busy(btn, async () => {
      if (!confirm(decision === 'accept' ? `${head.nick} さんが引き受ける、と記録しますか?` : `${head.nick} さんが断った、と記録しますか?\n次の人が先頭になり、管理者に知らせます。`)) return;
      const res = await api('queueDecide', { catId: c.id, qid: head.qid, decision });
      if (!res.ok) return show($('#d-err'), errText(res));
      await loadCat();
      show($('#d-decide-res'), res.accepted ? '引き受ける、と記録しました。' : (res.exhausted ? '断った、と記録しました。順番が尽きました。' : '断った、と記録しました。次の人が先頭です。') + (res.mailOk === false ? ' 管理者へのメールが送れていません(管理者の画面には載っています)。' : ' 管理者に知らせました。'));
    });
    $('#d-accept').onclick = () => dec($('#d-accept'), 'accept'); $('#d-decline').onclick = () => dec($('#d-decline'), 'decline');
    $('#d-handover').onclick = () => busy($('#d-handover'), async () => {
      if (!confirm(`${c.name} の引き継ぎが済みましたか?\n飼い主が ${head.nick} さんに変わります。順番は閉じます。`)) return;
      const res = await api('hospitalHandover', { catId: c.id });
      if (!res.ok) return show($('#d-err'), res.error === 'too_many_cats' ? `${head.nick} さんの猫が${res.max}頭になっているので、引き継げません。` : errText(res));
      await loadCat(); show($('#d-decide-res'), `引き継ぎ済みにしました。${c.name} の飼い主は ${head.nick} さんです。`);
    });
  }
  if (isUser() && !c.own) {
    $('#d-me').classList.remove('hidden');
    $('#d-mytag').innerHTML = (c.mine ? `<span class="tag g">あなたは${c.myOrder}番目</span>` : '') + `<span class="tag">手を挙げた人 ${c.raised}人</span>`;
    $('#d-raise').classList.toggle('hidden', c.mine || !c.canRaise); $('#d-lower').classList.toggle('hidden', !c.mine);
  }
}
let msgReq = rid();
$('#d-msg-go').onclick = () => busy($('#d-msg-go'), async () => {
  const text = $('#d-msg-text').value.trim(), v = $('#d-msg-to').value; show($('#d-msg-ok'), '');
  if (!text) return show($('#d-err'), ERR.bad_msg);
  const [to, qid] = v.split(':');
  const r = await api('msgSend', { reqId: msgReq, catId: openId, to, qid, text });
  if (!r.ok && r.error !== 'already_done') { if (r.error !== 'network') msgReq = rid(); return show($('#d-err'), errText(r)); }
  msgReq = rid(); $('#d-msg-text').value = ''; show($('#d-err'), ''); show($('#d-msg-ok'), '送りました。');
});
/* ---- メッセージの一覧 ---- */
function msgCard(m) {
  const d = document.createElement('div'); d.className = 'msg' + (m.unread ? ' unread' : ''); d.dataset.msg = m.id;
  const head = `${dayText(m.at)} ${m.mine ? 'あなた → ' + m.to : m.from}${m.catName ? ' ・ ' + m.catName : ''}`;
  d.innerHTML = `<small>${esc(head)}${m.kind ? ' <span class="tag r">' + esc(m.kind) + '</span>' : ''}${m.unread ? ' <b data-new="1">新しい</b>' : ''}</small>${esc(m.text)}`;
  if (m.catId) d.onclick = () => openCat(m.catId);
  return d;
}
async function loadMsgs() {
  setHeader('メッセージ', auth.role === 'hospital' ? '病院' : (auth.nick || ''), true); show($('#m-err'), '');
  const r = await api('msgList'); if (!r.ok) return seeErr(r, $('#m-err'));
  const box = $('#m-list'); box.innerHTML = '';
  if (!r.msgs.length) box.innerHTML = '<div class="card"><div class="note" style="margin:0">まだメッセージはありません。</div></div>';
  r.msgs.forEach(m => box.appendChild(msgCard(m)));
  if (r.unread) { await api('msgRead'); } setBadge(0);
}
$('#d-raise').onclick = () => busy($('#d-raise'), async () => { const r = await api('queueRaise', { catId: openId }); if (!r.ok && r.error !== 'already_raised') return show($('#d-err'), errText(r)); loadCat(); });
$('#d-lower').onclick = () => busy($('#d-lower'), async () => {
  if (!confirm('手を下ろしますか?\nもう一度挙げると、いちばん後ろになります。')) return;
  const r = await api('queueLower', { catId: openId }); if (!r.ok && r.error !== 'not_raised') return show($('#d-err'), errText(r)); loadCat(); });
async function loadSettings() {
  setHeader('設定', auth.nick || '', true); show($('#s-err'), ''); show($('#s-ok'), '');
  const r = await api('userHome'); if (!r.ok) return seeErr(r, $('#s-err'));
  const m = r.marks || { foster: false, life: false }; $('#s-foster').checked = m.foster; $('#s-life').checked = m.life;
}
$('#s-go').onclick = () => busy($('#s-go'), async () => {
  show($('#s-ok'), '');
  const r = await api('userMarks', { foster: $('#s-foster').checked, life: $('#s-life').checked });
  if (!r.ok) return show($('#s-err'), errText(r)); show($('#s-err'), ''); show($('#s-ok'), '保存しました。');
});

/* ---- 緊急ボタン(見本 8): 確かめてから送る。同じ猫の二度押しは受け付けが1件にまとめる ---- */
let sosReq = rid(), sosCats = [], sosHos = '';
function openSos(cats, hosName) {
  sosCats = cats; sosHos = hosName;
  const sel = $('#sos-cat'); sel.innerHTML = ''; cats.forEach(c => sel.add(new Option(c.name, c.id))); sel.classList.toggle('hidden', cats.length < 2);
  sosWhat(); $('#sos-ask').classList.remove('hidden'); $('#sos-res').classList.add('hidden'); $('#sos-modal').classList.remove('hidden');
}
function sosWhat() { const c = sosCats.find(x => x.id === $('#sos-cat').value) || sosCats[0] || {}; $('#sos-what').textContent = `猫: ${c.name || ''} ・ 病院: ${(c.hospital && c.hospital.name) || sosHos}`; }
$('#sos-cat').onchange = sosWhat;
$('#sos-no').onclick = () => $('#sos-modal').classList.add('hidden');
$('#sos-close').onclick = () => $('#sos-modal').classList.add('hidden');
$('#sos-yes').onclick = () => busy($('#sos-yes'), async () => {
  const r = await api('sosPress', { reqId: sosReq, catId: $('#sos-cat').value });
  const box = $('#sos-res-txt');
  if (!r.ok) { box.className = 'err'; box.textContent = errText(r); }
  else {
    sosReq = rid();
    box.className = r.mailOk ? 'ok' : 'err';
    box.textContent = (r.dup ? 'もう知らせてあります(同じ猫の知らせは1件にまとめました)。' : '管理者に知らせました。管理者が病院に電話します。')
      + (r.mailOk ? '' : ' ただし、管理者へのメールが送れていません。管理者の画面には載っています。急ぐ時は病院に直接電話してください。');
  }
  $('#sos-ask').classList.add('hidden'); $('#sos-res').classList.remove('hidden');
});
/* ---- 管理者: 電話が必要な連絡(見本 7) ---- */
const timeText = t => { const m = /^\d{4}-(\d\d)-(\d\d) (\d\d:\d\d)/.exec(t || ''); return m ? `${+m[1]}月${+m[2]}日 ${m[3]}` : ''; };
async function loadSos() {
  show($('#sos-err'), '');
  const r = await api('adminSosList');
  if (!r.ok) { if (!adminExpired(r)) show($('#sos-err'), errText(r)); return; }
  $('#sos-n').textContent = r.open + '件';
  const box = $('#sos-list'); box.innerHTML = '';
  if (!r.items.length) box.innerHTML = '<div class="card"><div class="note" style="margin:0">今は電話が必要な連絡はありません。</div></div>';
  r.items.forEach(x => {
    const d = document.createElement('div'); d.className = 'card' + (x.open ? ' sosrow' : ''); d.dataset.sos = x.id;
    const catLine = '猫: ' + x.cat + (x.kind === '緊急' ? (x.ownerNick ? `(飼い主 ${x.ownerNick})` : '') + (x.byRole === '病院' ? ' ・ 病院が押した' : '') : ' → ' + x.next);
    d.innerHTML = `<span class="tag r">${esc(x.kind)}</span><span class="note">${esc(timeText(x.at))}</span>${x.mailNg ? ' <span class="tag r" data-mailng="1">メールが送れていない</span>' : ''}`
      + `<div class="big" style="font-size:18px">${esc(x.hospital)}</div><a class="sostel" href="tel:${esc(x.phone)}">☎ ${esc(x.phone)}</a><div class="note" style="margin:0">${esc(catLine)}</div>`
      + `<div style="text-align:right">${x.mailNg ? '<button class="btn sm sub" type="button" data-resend="1">メールを送り直す</button>' : ''}${x.open ? '<button class="btn sm" type="button" data-done="1">連絡済み</button>' : '<span class="tag g">連絡済み</span>'}</div>`;
    const b = d.querySelector('[data-done]'), req = rid(), rb = d.querySelector('[data-resend]');
    if (rb) { let rreq = rid(); rb.onclick = () => busy(rb, async () => {   // 5枚目: 送れなかったメールを1回送り直す(送れたら印が消える)
      const res = await api('adminSosResend', { reqId: rreq, sosId: x.id }); rreq = rid();
      if (!res.ok) { if (!adminExpired(res)) show($('#sos-err'), errText(res)); return; }
      await loadSos();
      if (!res.mailOk) show($('#sos-err'), 'メールはまだ送れていません。時間をおいて、もう一度押してください。');
    }); }
    if (b) b.onclick = () => busy(b, async () => {
      if (!confirm(x.hospital + ' に電話して、連絡が済みましたか?')) return;
      const res = await api('adminSosDone', { reqId: req, sosId: x.id });
      if (!res.ok && res.error !== 'already_done') { if (!adminExpired(res)) show($('#sos-err'), errText(res)); return; }
      loadSos();
    });
    box.appendChild(d);
  });
}

/* ---- 起動 ---- */
async function boot() {
  device();
  const card = cardFromHash(), hm = /[#&]h=(h[0-9a-f]{10})/.exec(location.hash);
  if (card) { pendingCard = card; history.replaceState(null, '', location.pathname); return goLogin(); }   // 合言葉は覚えておき、住所の欄からは消す
  if (hm) return goHospitalReg(hm[1]);
  const re = /[#&]re=([A-Za-z0-9_-]{20,64})/.exec(location.hash);
  if (re) { history.replaceState(null, '', location.pathname); return goReissue(re[1]); }   // 作り直しの QR。住所の欄からは消す
  if (auth && auth.type === 'card') return routeCard();   // 利用者も病院も同じ道(whoami で役を見て分ける)
  if (auth && auth.type === 'google' && auth.exp * 1000 > Date.now() + 60e3) return goAdmin();
  saveAuth(null); goLogin();
}
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
