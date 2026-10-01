import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { beijingWeek, issueMusicSession, musicFetch, recommend, tokenHash, syncWeek } from './music.mjs';
import worker from './worker.mjs';

function setup() {
 const sqlite = new DatabaseSync(':memory:');
 sqlite.exec(readFileSync(new URL('./music-schema.sql', import.meta.url), 'utf8'));
 const db = {
  prepare(sql) {
   let params = [];
   const statement = sqlite.prepare(sql);
   return {
    bind(...values) { params = values; return this; },
    async first() { return statement.get(...params) || null; },
    async all() { return { results: statement.all(...params) }; },
    async run() { return { meta: statement.run(...params) }; },
   };
  },
  async batch(statements) { return Promise.all(statements.map(s => s.run())); },
 };
 const env = { MUSIC_DB: db, ALLOWED_SITE_ORIGIN: 'https://allenxia814.github.io', ALLOWED_USER_ID: '189645776', GITHUB_REPO: 'Allenxia814/Allenxia814.github.io', GITHUB_CLIENT_ID: 'test-id', GITHUB_CLIENT_SECRET: 'test-secret', STATE_SECRET: 'test-state-secret-at-least-32-characters' };
 return { sqlite, env };
}
const ids = [1,2,3,4].map(n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
function seed(sqlite) {
 for (const [i, id] of ids.entries()) {
  sqlite.prepare('INSERT INTO music_albums(id,title,artist,released,cover,cover_checked,discovered) VALUES (?,?,?,?,?,?,?)').run(id, `Album ${i}`, 'Artist', '2020-01-01', `https://coverartarchive.org/release-group/${id}/front-500`, Date.now(), Date.now());
  sqlite.prepare('INSERT INTO music_genres VALUES (?,?)').run(id, i < 3 ? 'hip-hop' : 'pop');
 }
}
test('Beijing week changes exactly at Monday midnight, across month and year boundaries', () => {
 assert.deepEqual(beijingWeek(Date.parse('2026-01-04T15:59:59Z')), { start:'2025-12-29',end:'2026-01-04',today:'2026-01-04' });
 assert.deepEqual(beijingWeek(Date.parse('2026-01-04T16:00:00Z')), { start:'2026-01-05',end:'2026-01-11',today:'2026-01-05' });
});
test('private APIs reject anonymous, expired, forged and foreign-account sessions', async () => {
 const { sqlite, env } = setup();
 seed(sqlite);
 for (const path of ['session','week','history','recommend']) {
  const response = await musicFetch(new Request(`https://auth.example/music/${path}`, { method: path === 'recommend' ? 'POST' : 'GET' }), env);
  assert.equal(response.status,401);
  assert(!JSON.stringify(await response.json()).includes('Album'));
 }
 const forged = 'a'.repeat(64);
 sqlite.prepare('INSERT INTO music_sessions VALUES (?,?,?)').run(await tokenHash(forged), '123', Date.now()+60000);
 assert.equal((await musicFetch(new Request('https://auth.example/music/history', { headers: { Authorization:`Bearer ${forged}` } }), env)).status,401);
 const session = await issueMusicSession(env, { id:189645776,login:'Allenxia814' });
 assert.equal((await musicFetch(new Request('https://auth.example/music/session', {headers:{Authorization:`Bearer ${session.token}`,Origin:'https://evil.example'}}),env)).status,403);
 sqlite.prepare('UPDATE music_sessions SET expires=0').run();
 assert.equal((await musicFetch(new Request('https://auth.example/music/session', {headers:{Authorization:`Bearer ${session.token}`}}),env)).status,401);
 await assert.rejects(() => issueMusicSession(env,{id:123}),/Forbidden/);
 sqlite.close();
});
test('recommendations never repeat across genres, random mode, retries and concurrent requests', async () => {
 const {sqlite,env} = setup(); seed(sqlite);
 const one = await recommend(env,'genre','hip-hop',crypto.randomUUID());
 const retryId = crypto.randomUUID();
 const two = await recommend(env,'random','',retryId);
 assert.equal((await recommend(env,'random','',retryId)).id,two.id);
 const simultaneous = await Promise.all([recommend(env,'random','',crypto.randomUUID()),recommend(env,'random','',crypto.randomUUID())]);
 assert.equal(new Set([one.id,two.id,...simultaneous.map(a=>a.id)]).size,4);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM music_history').get().n,4);
 sqlite.close();
});
test('bad genre and mode inputs fail without calling the music source', async () => {
 const {sqlite,env}=setup();
 await assert.rejects(() => recommend(env,'genre','" OR *',crypto.randomUUID()),e=>e.status===400);
 await assert.rejects(() => recommend(env,'unknown','',crypto.randomUUID()),e=>e.status===400);
 sqlite.close();
});
test('history pagination preserves albums even when recommendation timestamps are identical', async () => {
 const {sqlite,env}=setup();
 const timestamp=Date.now();
 for(let i=0;i<30;i++) {
  const id=`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
  sqlite.prepare('INSERT INTO music_albums(id,title,artist,released,discovered) VALUES (?,?,?,?,?)').run(id,'Album','Artist','2020-01-01',timestamp);
  sqlite.prepare('INSERT INTO music_history VALUES (?,?,?,?,?,?)').run(id,env.ALLOWED_USER_ID,timestamp,'random','',crypto.randomUUID());
 }
 const session=await issueMusicSession(env,{id:189645776,login:'Allenxia814'});
 const headers={Authorization:`Bearer ${session.token}`};
 const first=await (await musicFetch(new Request('https://auth.example/music/history',{headers}),env)).json();
 assert.equal(first.albums.length,24);
 const last=first.albums.at(-1);
 const second=await (await musicFetch(new Request(`https://auth.example/music/history?before=${last.recommended}&last=${last.id}`,{headers}),env)).json();
 assert.equal(second.albums.length,6);
 assert.equal(new Set([...first.albums,...second.albums].map(a=>a.id)).size,30);
 sqlite.close();
});
test('logout revokes the stored session and leaves recommendation history intact', async () => {
 const {sqlite,env}=setup(); seed(sqlite);
 await recommend(env,'random','',crypto.randomUUID());
 const session=await issueMusicSession(env,{id:189645776,login:'Allenxia814'});
 const headers={Authorization:`Bearer ${session.token}`,Origin:env.ALLOWED_SITE_ORIGIN};
 const response=await musicFetch(new Request('https://auth.example/music/logout',{method:'POST',headers}),env);
 assert.equal(response.status,200);
 assert.equal((await musicFetch(new Request('https://auth.example/music/history',{headers}),env)).status,401);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM music_history').get().n,1);
 sqlite.close();
});
test('weekly albums use first release date and exclude future releases and old reissues', async () => {
 const {sqlite,env}=setup();
 const week=beijingWeek();
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
  const query=new URL(url).searchParams.get('query');
  assert(query.includes(`firstreleasedate:[${week.start} TO ${week.end}]`));
  return Response.json({count:3,'release-groups':[
   {id:ids[0],title:'This week','primary-type':'Album','first-release-date':week.start,'artist-credit':[{name:'Artist'}]},
   {id:ids[1],title:'Old reissue','primary-type':'Album','first-release-date':'2000-01-01','artist-credit':[{name:'Artist'}]},
   {id:ids[2],title:'Future','primary-type':'Album','first-release-date':'2099-01-01','artist-credit':[{name:'Artist'}]},
  ]});
 };
 try {
  await syncWeek(env,true);
  const session=await issueMusicSession(env,{id:189645776,login:'Allenxia814'});
  const response=await musicFetch(new Request('https://auth.example/music/week',{headers:{Authorization:`Bearer ${session.token}`}}),env);
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).albums.map(a=>a.title),['This week']);
 } finally { globalThis.fetch=original; sqlite.close(); }
});
test('music OAuth checks the numeric owner and returns an opaque session, never a GitHub token', async () => {
 const {sqlite,env}=setup();
 const auth=await worker.fetch(new Request('https://auth.example/auth?provider=github&site_id=allenxia814.github.io&purpose=music'),env);
 const location=new URL(auth.headers.get('location'));
 assert.equal(location.searchParams.get('scope'),'');
 const original=globalThis.fetch;
 globalThis.fetch=async url=> {
  if(url.endsWith('/access_token'))return Response.json({access_token:'private-github-token',token_type:'bearer'});
  if(url.endsWith('/user'))return Response.json({id:189645776,login:'Allenxia814'});
  throw new Error('Music sign-in must not request repository access');
 };
 try {
  const result=await worker.fetch(new Request(`https://auth.example/callback?code=ok&state=${location.searchParams.get('state')}`,{headers:{Cookie:auth.headers.get('set-cookie').split(';')[0]}}),env);
  const html=await result.text();
  assert(html.includes('authorization:airglow-music:success:'));
  assert(!html.includes('private-github-token'));
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM music_sessions').get().n,1);
  assert(!html.includes('postMessage(message, "*")'));
 }finally {globalThis.fetch=original;sqlite.close();}
});
