export const GENRES = [
 { id: "hip-hop", name: "嘻哈", tags: ["hip hop", "hip-hop", "rap"] },
 { id: "pop", name: "流行", tags: ["pop", "pop music"] },
 { id: "rock", name: "摇滚", tags: ["rock"] },
 { id: "indie", name: "独立", tags: ["indie", "indie rock", "indie pop"] },
 { id: "electronic", name: "电子", tags: ["electronic", "electronica"] },
 { id: "rnb", name: "R&B / 灵魂", tags: ["r&b", "soul", "rhythm and blues"] },
 { id: "jazz", name: "爵士", tags: ["jazz"] },
 { id: "folk", name: "民谣", tags: ["folk"] },
 { id: "classical", name: "古典", tags: ["classical"] },
 { id: "metal", name: "金属", tags: ["metal", "heavy metal"] },
 { id: "ambient", name: "氛围", tags: ["ambient"] },
 { id: "funk", name: "放克", tags: ["funk"] },
 { id: "reggae", name: "雷鬼", tags: ["reggae"] },
 { id: "blues", name: "蓝调", tags: ["blues"] },
 { id: "punk", name: "朋克", tags: ["punk", "punk rock"] },
 { id: "soundtrack", name: "原声", tags: ["soundtrack", "film score"] },
];
const BASE_QUERY = 'primarytype:album AND status:official AND NOT secondarytype:compilation AND NOT secondarytype:live AND NOT secondarytype:remix';
const encoder = new TextEncoder();
const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
export function beijingWeek(now = Date.now()) {
 const date = new Date(now + 8 * 3600000);
 const today = date.toISOString().slice(0, 10);
 date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
 const start = date.toISOString().slice(0, 10);
 date.setUTCDate(date.getUTCDate() + 6);
 return { start, end: date.toISOString().slice(0, 10), today };
}
export async function tokenHash(token) {
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token))), b => b.toString(16).padStart(2, '0')).join('');
}
export async function issueMusicSession(env, user) {
 if (!env.MUSIC_DB || String(user.id) !== env.ALLOWED_USER_ID) throw new Error('Forbidden');
 const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
 const expires = Date.now() + SESSION_AGE;
 await env.MUSIC_DB.batch([
  env.MUSIC_DB.prepare('DELETE FROM music_sessions WHERE expires <= ?').bind(Date.now()),
  env.MUSIC_DB.prepare('INSERT INTO music_sessions(hash, user_id, expires) VALUES (?, ?, ?)').bind(await tokenHash(token), String(user.id), expires),
 ]);
 return { token, expires, login: user.login };
}
function json(env, data, status = 200) {
 return Response.json(data, { status, headers: {
  'Access-Control-Allow-Origin': env.ALLOWED_SITE_ORIGIN, 'Vary': 'Origin',
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
 } });
}
function error(message, status = 503) { return Object.assign(new Error(message), { status }); }
function album(row) { return { id: row.id, title: row.title, artist: row.artist, released: row.released, cover: row.cover || null, recommended: row.recommended, mode: row.mode, genre: row.genre }; }
async function upstream(env, query, offset = 0) {
 // One shared database lock also throttles different Worker instances.
 const until = Date.now() + 1100;
 const lock = await env.MUSIC_DB.prepare("UPDATE music_locks SET until_ms = ? WHERE key = 'musicbrainz' AND until_ms <= ? RETURNING key").bind(until, Date.now()).first();
 if (!lock) throw error('音乐库正在同步，请稍后再试。', 429);
 const url = new URL('https://musicbrainz.org/ws/2/release-group');
 url.search = new URLSearchParams({ query, fmt: 'json', limit: '100', offset: String(offset) }).toString();
 const response = await fetch(url, { headers: { 'User-Agent': 'AirglowMusic/1.0 (https://allenxia814.github.io/)', Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
 if (!response.ok) throw error('音乐数据源暂时不可用，请稍后重试。');
 return response.json();
}
function queryFor(genre) {
 const spec = GENRES.find(g => g.id === genre);
 return spec ? `${BASE_QUERY} AND (${spec.tags.map(t => `tag:"${t}"`).join(' OR ')})` : BASE_QUERY;
}
async function saveGroups(env, groups, genre = '') {
 const statements = [];
 for (const group of groups) {
  if (!/^[\da-f-]{36}$/.test(group.id) || !group.title || group['primary-type'] !== 'Album') continue;
  const credit = (group['artist-credit'] || []).map(c => `${c.name || c.artist?.name || ''}${c.joinphrase || ''}`).join('');
  if (!credit) continue;
  statements.push(env.MUSIC_DB.prepare('INSERT INTO music_albums(id,title,artist,released,discovered) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, artist=excluded.artist, released=excluded.released').bind(group.id, group.title, credit, group['first-release-date'] || '', Date.now()));
  if (genre) statements.push(env.MUSIC_DB.prepare('INSERT OR IGNORE INTO music_genres(album_id,genre) VALUES (?,?)').bind(group.id, genre));
 }
 // Keep D1 batches bounded, independent of upstream result counts.
 for (let i = 0; i < statements.length; i += 40) await env.MUSIC_DB.batch(statements.slice(i, i + 40));
}
export async function syncLibrary(env, genre = '', force = false) {
 const key = `library:${genre || 'random'}`;
 const previous = await env.MUSIC_DB.prepare('SELECT * FROM music_sync WHERE key=?').bind(key).first();
 if (!force && previous && previous.updated > Date.now() - 6 * 3600000) return;
 const maxOffset = Math.max(0, (previous?.total || 100) - 100);
 const offset = previous ? Math.floor(Math.random() * (maxOffset + 1)) : 0;
 const result = await upstream(env, queryFor(genre), offset);
 await saveGroups(env, result['release-groups'] || [], genre);
 await env.MUSIC_DB.prepare('INSERT INTO music_sync(key,updated,total,cursor) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET updated=excluded.updated,total=excluded.total,cursor=excluded.cursor').bind(key, Date.now(), result.count || 0, offset).run();
}
export async function syncWeek(env, force = false) {
 const week = beijingWeek();
 const key = `week:${week.start}`;
 const previous = await env.MUSIC_DB.prepare('SELECT * FROM music_sync WHERE key=?').bind(key).first();
 if (!force && previous && previous.updated > Date.now() - 6 * 3600000) return;
 const offset = previous && previous.cursor < previous.total ? previous.cursor : 0;
 const result = await upstream(env, `${BASE_QUERY} AND firstreleasedate:[${week.start} TO ${week.end}]`, offset);
 await saveGroups(env, result['release-groups'] || []);
 await env.MUSIC_DB.prepare('INSERT INTO music_sync(key,updated,total,cursor) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET updated=excluded.updated,total=excluded.total,cursor=excluded.cursor').bind(key, Date.now(), result.count || 0, offset + (result['release-groups'] || []).length).run();
}
async function checkCover(env, row) {
 if (row.cover_checked > Date.now() - 7 * 86400000) return row.cover;
 const url = `https://coverartarchive.org/release-group/${row.id}/front-500`;
 const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
 const cover = response.ok ? url : null;
 // A temporary outage must not mark an album as lacking art.
 if (response.ok || response.status === 404) await env.MUSIC_DB.prepare('UPDATE music_albums SET cover=?,cover_checked=? WHERE id=?').bind(cover, Date.now(), row.id).run();
 return cover;
}
async function history(env, limit = 24, before = Date.now() + 1, last = '') {
 const rows = await env.MUSIC_DB.prepare('SELECT a.*,h.recommended,h.mode,h.genre FROM music_history h JOIN music_albums a ON a.id=h.album_id WHERE h.user_id=? AND (h.recommended < ? OR (h.recommended = ? AND h.album_id < ?)) ORDER BY h.recommended DESC,h.album_id DESC LIMIT ?').bind(env.ALLOWED_USER_ID, before, before, last, limit).all();
 return rows.results.map(album);
}
export async function recommend(env, mode, genre, requestId) {
 if (!['genre', 'random'].includes(mode) || (mode === 'genre' && !GENRES.some(g => g.id === genre)) || !/^[\da-f-]{36}$/.test(requestId || '')) throw error('请选择推荐方式和音乐风格。', 400);
 const prior = await env.MUSIC_DB.prepare('SELECT a.*,h.recommended,h.mode,h.genre FROM music_history h JOIN music_albums a ON a.id=h.album_id WHERE request_id=? AND user_id=?').bind(requestId, env.ALLOWED_USER_ID).first();
 if (prior) return album(prior);
 const filter = mode === 'genre' ? genre : '';
 // Several candidates allow for missing covers and simultaneous requests.
 for (let round = 0; round < 2; round++) {
  const rows = await env.MUSIC_DB.prepare("SELECT a.* FROM music_albums a WHERE NOT EXISTS(SELECT 1 FROM music_history h WHERE h.album_id=a.id) AND (?='' OR EXISTS(SELECT 1 FROM music_genres g WHERE g.album_id=a.id AND g.genre=?)) AND (a.released='' OR a.released<=?) AND (a.cover IS NOT NULL OR a.cover_checked=0 OR a.cover_checked<?) ORDER BY RANDOM() LIMIT 8").bind(filter, filter, beijingWeek().today, Date.now() - 7 * 86400000).all();
  for (const row of rows.results) {
   let cover;
   try { cover = await checkCover(env, row); } catch { throw error('封面服务暂时不可用，请稍后重试。'); }
   if (!cover) continue;
   const recommended = Date.now();
   const inserted = await env.MUSIC_DB.prepare('INSERT OR IGNORE INTO music_history(album_id,user_id,recommended,mode,genre,request_id) VALUES (?,?,?,?,?,?) RETURNING album_id').bind(row.id, env.ALLOWED_USER_ID, recommended, mode, filter, requestId).first();
   if (inserted) return album({ ...row, cover, recommended, mode, genre: filter });
   // A retry with the same request ID must return the original album.
   const existing = await env.MUSIC_DB.prepare('SELECT a.*,h.recommended,h.mode,h.genre FROM music_history h JOIN music_albums a ON a.id=h.album_id WHERE request_id=? AND user_id=?').bind(requestId, env.ALLOWED_USER_ID).first();
   if (existing) return album(existing);
  }
  if (round === 0) await syncLibrary(env, filter, true);
 }
 throw error('暂时没有带封面的未推荐专辑，请换一种曲风或稍后再试。历史记录已保留，不会重复推荐。', 409);
}
export async function musicFetch(request, env) {
 const origin = request.headers.get('Origin');
 if (origin && origin !== env.ALLOWED_SITE_ORIGIN) return json(env, { message: '禁止访问' }, 403);
 if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': env.ALLOWED_SITE_ORIGIN, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin' } });
 if (!env.MUSIC_DB) return json(env, { message: '音乐服务尚未配置。' }, 503);
 const token = request.headers.get('Authorization')?.match(/^Bearer ([\da-f]{64})$/)?.[1];
 const session = token ? await env.MUSIC_DB.prepare('SELECT * FROM music_sessions WHERE hash=? AND expires>?').bind(await tokenHash(token), Date.now()).first() : null;
 if (!session || session.user_id !== env.ALLOWED_USER_ID) return json(env, { message: '请使用博客所有者的 GitHub 账号登录。' }, 401);
 const url = new URL(request.url);
 try {
  if (url.pathname === '/music/session' && request.method === 'GET') return json(env, { owner: true, expires: session.expires, genres: GENRES.map(({ id, name }) => ({ id, name })) });
  if (url.pathname === '/music/logout' && request.method === 'POST') {
   await env.MUSIC_DB.prepare('DELETE FROM music_sessions WHERE hash=?').bind(await tokenHash(token)).run();
   return json(env, { ok: true });
  }
  if (url.pathname === '/music/history' && request.method === 'GET') {
   const before = Number(url.searchParams.get('before')) || Date.now() + 1;
   const last = url.searchParams.get('last') || '';
   return json(env, { albums: await history(env, 24, before, /^[\da-f-]{36}$/.test(last) ? last : '') });
  }
  if (url.pathname === '/music/recommend' && request.method === 'POST') {
   if (Number(request.headers.get('Content-Length')) > 2048) return json(env, { message: '请求过大' }, 413);
   const body = await request.text();
   if (body.length > 2048) return json(env, { message: '请求过大' }, 413);
   let params;
   try { params = JSON.parse(body); } catch { throw error('无效请求', 400); }
   return json(env, { album: await recommend(env, params.mode, params.genre, params.requestId) });
  }
  if (url.pathname === '/music/week' && request.method === 'GET') {
   const week = beijingWeek();
   let warning = '';
   try { await syncWeek(env); } catch (e) { warning = e.message; }
   const rows = await env.MUSIC_DB.prepare('SELECT * FROM music_albums WHERE length(released)=10 AND released>=? AND released<=? ORDER BY released DESC,title LIMIT 60').bind(week.start, week.today).all();
   const sync = await env.MUSIC_DB.prepare('SELECT updated FROM music_sync WHERE key=?').bind(`week:${week.start}`).first();
   return json(env, { week, albums: rows.results.map(r => album({ ...r, cover: r.cover || `https://coverartarchive.org/release-group/${r.id}/front-500` })), updated: sync?.updated || null, warning });
  }
  return json(env, { message: '未找到此功能' }, 404);
 } catch (e) { return json(env, { message: e.status ? e.message : '音乐服务暂时不可用，请稍后重试。' }, e.status || 503); }
}
export async function scheduledMusic(controller, env) {
 if (!env.MUSIC_DB) return;
 const hour = Math.floor(controller.scheduledTime / 3600000);
 // Genre rotation grows the library. Every sixth hour refreshes this week.
 if (hour % 6 === 0) await syncWeek(env, true);
 else await syncLibrary(env, hour % 5 === 0 ? '' : GENRES[hour % GENRES.length].id, true);
 await env.MUSIC_DB.prepare('DELETE FROM music_sessions WHERE expires<=?').bind(Date.now()).run();
}
