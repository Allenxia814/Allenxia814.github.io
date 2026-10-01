<script lang="ts">
 import { onMount } from 'svelte';
 import AlbumCover from './AlbumCover.svelte';
 import { getMusicSession, saveMusicSession, musicApi, musicLogin, type Album, type Genre } from '../../utils/music-client';
 let ready = false, owner = false, logging = false, busy = false, weekBusy = false, moreBusy = false;
 let message = '', weekMessage = '', genres: Genre[] = [], genre = 'hip-hop', mode = 'genre';
 let selected: Album | null = null, records: Album[] = [], weekly: Album[] = [];
 let week = { start: '', end: '' }, updated: number | null = null, more = false;
 let requestId: string | null = null;
 const time = (value: number) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value);
 const genreName = (id?: string) => genres.find(g => g.id === id)?.name || '随机发现';
 async function loadWeek() {
  weekBusy = true;
  try {
   const data = await musicApi<{week: typeof week; albums: Album[]; updated: number | null; warning?: string}>('week');
   week = data.week; weekly = data.albums; updated = data.updated; weekMessage = data.warning || '';
  } catch (e) { weekMessage = e instanceof Error ? e.message : '新专辑暂时无法加载。'; }
  finally { weekBusy = false; }
 }
 async function loadHistory(append = false) {
  const before = append ? records.at(-1)?.recommended : undefined;
  const last = append ? records.at(-1)?.id : undefined;
  const data = await musicApi<{albums: Album[]}>(`history${before ? `?before=${before}&last=${last}` : ''}`);
  records = append ? [...records, ...data.albums] : data.albums;
  more = data.albums.length === 24;
  if (!append) selected = data.albums[0] || null;
 }
 async function enter() {
  const data = await musicApi<{owner: boolean; genres: Genre[]}>('session');
  owner = data.owner; genres = data.genres;
  if (owner) {
   try { await loadHistory(); } catch { message = '推荐历史暂时无法加载，可以稍后重试。'; }
   void loadWeek();
  }
 }
 async function login() {
  logging = true; message = '';
  try { await musicLogin(); await enter(); }
  catch (e) { message = e instanceof Error ? e.message : '登录失败，请重试。'; }
  finally { logging = false; }
 }
 async function logout() {
  try { await musicApi('logout', {}); } catch { /* Local logout always clears the private view. */ }
  saveMusicSession(null); owner = false; selected = null; records = []; weekly = []; message = ''; requestId = null;
 }
 async function discover() {
  busy = true; message = '';
  requestId ||= crypto.randomUUID();
  try {
   const data = await musicApi<{album: Album}>('recommend', { mode, genre: mode === 'genre' ? genre : '', requestId });
   selected = data.album;
   records = [data.album, ...records.filter(a => a.id !== data.album.id)];
   requestId = null;
  } catch (e) { message = e instanceof Error ? e.message : '推荐失败，请稍后重试。'; }
  finally { busy = false; }
 }
 async function loadMore() {
  moreBusy = true;
  try { await loadHistory(true); } catch (e) { message = e instanceof Error ? e.message : '历史加载失败。'; }
  finally { moreBusy = false; }
 }
 onMount(() => {
  const changed = () => { if (!getMusicSession()) { owner = false; selected = null; records = []; weekly = []; } };
  window.addEventListener('airglow-music-session', changed);
  window.addEventListener('storage', changed);
  const expiry = setInterval(changed, 30000);
  (async () => { try { if (getMusicSession()) await enter(); } catch (e) { message = e instanceof Error ? e.message : '请重新登录。'; } finally { ready = true; } })();
  return () => { clearInterval(expiry); window.removeEventListener('airglow-music-session', changed); window.removeEventListener('storage', changed); };
 });
</script>

{#if !ready}
 <section class="card-base gate"><p class="eyebrow">AIRGLOW / MUSIC</p><h1>正在打开音乐空间…</h1><p class="muted">验证你的登录状态</p></section>
{:else if !owner}
 <section class="card-base gate">
  <div class="gate-icon" aria-hidden="true">♫</div><p class="eyebrow">YOUR PRIVATE LISTENING ROOM</p><h1>音乐，只留给自己。</h1>
  <p class="muted">这里是 Airglow 的私人音乐空间。<br />使用博客所有者的 GitHub 账号登录后进入。</p>
  <button class="primary" on:click={login} disabled={logging}>{logging ? '等待 GitHub 登录…' : '使用 GitHub 登录'}</button>
  {#if message}<p class="notice" role="alert">{message}</p>{/if}
 </section>
{:else}
 <section class="card-base room">
  <div class="room-top"><p class="eyebrow">AIRGLOW / PRIVATE MUSIC</p><button class="text-button" on:click={logout}>退出登录 ↗</button></div>
  <h1>今天听什么<span>？</span></h1><p class="muted intro">换一种曲风，或让下一张专辑带你去未知的地方。</p>
  <div class="discovery">
   <div class="controls">
    <div class="mode" role="group" aria-label="推荐方式">
     <button class:active={mode === 'genre'} aria-pressed={mode === 'genre'} disabled={busy} on:click={() => { mode = 'genre'; requestId = null; }}>按曲风</button>
     <button class:active={mode === 'random'} aria-pressed={mode === 'random'} disabled={busy} on:click={() => { mode = 'random'; requestId = null; }}>随意发现</button>
    </div>
    {#if mode === 'genre'}
     <label for="music-genre">今天的曲风</label><select id="music-genre" bind:value={genre} disabled={busy} on:change={() => requestId = null}>{#each genres as g}<option value={g.id}>{g.name}</option>{/each}</select>
     <p class="muted mode-note">从 {genreName(genre)} 专辑中，为你挑一张还没推荐过的。</p>
    {:else}<div class="random-note"><span aria-hidden="true">✦</span><h2>不给耳朵设限</h2><p class="muted">不限定曲风，也许下一张<br />就是意想不到的喜欢。</p></div>{/if}
    <button class="primary" disabled={busy} on:click={discover}>{busy ? '正在寻找下一张…' : selected ? '再推荐一张 ↗' : '推荐一张专辑 ↗'}</button>
    <p class="memory"><span aria-hidden="true">✓</span> 每次推荐都会记住，跨曲风也不重复。</p>
   </div>
   <div class="featured" aria-live="polite" aria-busy={busy}>
    {#if selected}<AlbumCover src={selected.cover} title={selected.title} eager /><div class="album-caption"><p class="eyebrow">{selected.mode === 'genre' ? genreName(selected.genre) : 'AN UNEXPECTED DISCOVERY'}</p><h2>{selected.title}</h2><p class="muted artist">{selected.artist}</p></div>
    {:else}<div class="empty-cover"><span aria-hidden="true">♫</span><p>下一张喜欢，正在等你。</p></div>{/if}
   </div>
  </div>
  {#if message}<p class="notice" role="alert">{message}</p>{/if}
 </section>

 <section class="card-base collection">
  <div class="section-head"><div><p class="eyebrow">NEW THIS WEEK</p><h2>本周新发行</h2><p class="muted small">{week.start && week.end ? `${week.start} — ${week.end} · 北京时间` : '按北京时间周一至周日'}</p></div><button class="text-button" on:click={loadWeek} disabled={weekBusy}>{weekBusy ? '更新中…' : '刷新 ↻'}</button></div>
  {#if weekMessage}<p class="notice" role="status">{weekMessage}</p>{/if}
  {#if weekly.length}<div class="album-grid">{#each weekly as a (a.id)}<article><AlbumCover src={a.cover} title={a.title} /><h3>{a.title}</h3><p class="muted small">{a.artist}</p><p class="date">{a.released}</p></article>{/each}</div>
  {:else}<p class="empty-list">{weekBusy ? '正在寻找本周的新专辑…' : '暂未收录本周的新专辑。稍后回来看看。'}</p>{/if}
  <p class="source muted small">{updated ? `最近同步 ${time(updated)} · ` : ''}MusicBrainz / Cover Art Archive · 收录时间可能晚于发行时间</p>
 </section>

 <section class="card-base collection">
  <div class="section-head"><div><p class="eyebrow">YOUR DISCOVERIES</p><h2>推荐足迹</h2><p class="muted small">记录每一次发现，换设备也不会丢失。</p></div><span class="history-mark">已推荐</span></div>
  {#if records.length}<div class="album-grid">{#each records as a (a.id)}<article><AlbumCover src={a.cover} title={a.title} /><h3>{a.title}</h3><p class="muted small">{a.artist}</p><p class="date">{genreName(a.genre)}{a.recommended ? ` · ${time(a.recommended)}` : ''}</p></article>{/each}</div>
  {:else}<p class="empty-list">从第一张专辑开始，留下你的音乐足迹。</p>{/if}
  {#if more}<button class="more-button" disabled={moreBusy} on:click={loadMore}>{moreBusy ? '正在加载…' : '查看更早的推荐 ↓'}</button>{/if}
 </section>
{/if}

<style>
 :global([data-owner-music][style*="display: none"]){display:none!important}
 .gate,.room,.collection{color:inherit;padding:32px;margin-bottom:16px}.gate{text-align:center;padding:64px 24px;min-height:410px}.gate-icon{color:var(--primary);font-size:3rem;margin-bottom:20px}.eyebrow{font-size:.67rem;letter-spacing:.18em;font-weight:700;color:var(--primary);margin:0 0 14px}.room-top,.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.room-top .eyebrow{margin-top:5px}h1{font-weight:700;font-size:2rem;letter-spacing:-.03em;line-height:1.3;margin:8px 0 12px}h1 span{color:var(--primary)}.muted{opacity:.58;line-height:1.7}.intro{margin-bottom:28px}.small{font-size:.77rem}.gate .muted{margin:16px 0 28px}.primary{color:var(--deep-text);background:var(--primary);border-radius:12px;font-weight:700;padding:14px 22px;transition:filter .2s;min-height:48px}.primary:hover{filter:brightness(1.1)}button:disabled,select:disabled{opacity:.5;cursor:wait}button:focus-visible,select:focus-visible{outline:2px solid var(--primary);outline-offset:4px}.text-button{font-size:.75rem;opacity:.6;padding:4px 0;white-space:nowrap}.text-button:hover{opacity:1;color:var(--primary)}.discovery{display:grid;grid-template-columns:1fr 1.1fr;gap:32px;align-items:center}.controls{min-width:0}.mode{display:flex;gap:4px;background:var(--btn-plain-bg-hover);padding:5px;border-radius:13px;margin-bottom:28px}.mode button{flex:1;padding:10px 5px;font-size:.83rem;white-space:nowrap;border-radius:9px;opacity:.6}.mode button.active{background:var(--btn-regular-bg);color:var(--primary);opacity:1;font-weight:700}label{display:block;font-size:.8rem;opacity:.6;margin-bottom:10px}select{width:100%;padding:14px;border:1px solid color-mix(in srgb,var(--primary) 25%,transparent);border-radius:12px;background:var(--card-bg);font-weight:700;color:inherit;cursor:pointer}.mode-note{font-size:.8rem;margin:16px 0 26px}.controls .primary{width:100%}.memory{font-size:.68rem;opacity:.55;margin-top:14px;line-height:1.6}.memory span{color:var(--primary);margin-right:4px}.random-note{padding:6px 0 24px}.random-note span{font-size:2rem;color:var(--primary)}.random-note h2{font-size:1.2rem;font-weight:700;margin:8px 0}.random-note p{font-size:.83rem}.featured{min-width:0}.album-caption{padding-top:18px}.album-caption .eyebrow{font-size:.6rem;margin-bottom:8px}.album-caption h2{font-size:1.25rem;font-weight:700;line-height:1.4;overflow-wrap:anywhere}.artist{font-size:.85rem;margin-top:6px}.empty-cover{aspect-ratio:1;border-radius:16px;background:radial-gradient(ellipse at top left,color-mix(in srgb,var(--primary) 18%,transparent),var(--btn-plain-bg-hover));display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px}.empty-cover span{font-size:4rem;color:var(--primary);opacity:.6}.empty-cover p{font-size:.8rem;opacity:.5}.notice{font-size:.8rem;line-height:1.7;background:var(--btn-plain-bg-hover);padding:12px 16px;border-radius:10px;margin-top:18px}.section-head{margin-bottom:24px}.section-head .eyebrow{margin-bottom:7px}.section-head h2{font-size:1.2rem;font-weight:700;margin-bottom:8px}.album-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px 16px}.album-grid h3{font-weight:700;font-size:.86rem;margin-top:12px;line-height:1.5;overflow-wrap:anywhere}.album-grid .small{margin-top:4px;overflow-wrap:anywhere}.date{font-size:.65rem;opacity:.4;margin-top:8px;line-height:1.6}.source{margin-top:28px;font-size:.64rem}.empty-list{text-align:center;padding:32px 10px;font-size:.84rem;opacity:.5}.history-mark{font-size:.65rem;color:var(--primary);background:var(--btn-regular-bg);padding:6px 10px;border-radius:20px}.more-button{display:block;margin:28px auto 0;color:var(--primary);font-size:.8rem;padding:10px 18px;border-radius:10px;background:var(--btn-regular-bg)}
 @media(max-width:640px){.room,.collection{padding:24px 20px}.discovery{grid-template-columns:1fr;gap:24px}.featured{max-width:340px;width:100%;margin:auto}.controls{order:0}.featured{order:1}.mode{margin-bottom:20px}.intro{font-size:.82rem}.album-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 14px}h1{font-size:1.7rem}.room-top .eyebrow{font-size:.57rem}.section-head .small{font-size:.65rem}.gate h1{font-size:1.6rem}.gate{padding:52px 20px}}
</style>
