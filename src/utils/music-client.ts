export const MUSIC_ORIGIN = import.meta.env.PUBLIC_CMS_AUTH_URL || 'https://airglow-github-auth.github-oauth.workers.dev';
const KEY = 'airglow-music-session';
export interface MusicSession { token: string; expires: number }
export interface Album { id: string; title: string; artist: string; released: string; cover: string | null; recommended?: number; mode?: string; genre?: string }
export interface Genre { id: string; name: string }
export function getMusicSession(): MusicSession | null {
 try {
  const session = JSON.parse(localStorage.getItem(KEY) || 'null');
  return session && /^[\da-f]{64}$/.test(session.token) && session.expires > Date.now() ? session : null;
 } catch { return null; }
}
export function saveMusicSession(session: MusicSession | null) {
 if (session) localStorage.setItem(KEY, JSON.stringify(session)); else localStorage.removeItem(KEY);
 window.dispatchEvent(new Event('airglow-music-session'));
}
export async function musicApi<T>(path: string, body?: unknown): Promise<T> {
 const session = getMusicSession();
 if (!session) throw new Error('请先使用 GitHub 登录。');
 let response: Response;
 try { response = await fetch(`${MUSIC_ORIGIN}/music/${path}`, {
  method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
  headers: { Authorization: `Bearer ${session.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(55000),
 }); } catch (error) {
  throw new Error(error instanceof DOMException && error.name === 'TimeoutError' ? '响应较慢，请稍后重试；已经保存的推荐不会重复。' : '连接音乐服务失败，请检查网络后重试。');
 }
 const result = await response.json();
 if (response.status === 401) saveMusicSession(null);
 if (!response.ok) throw new Error(result.message || '请求失败，请稍后重试。');
 return result;
}
let navigationCheck = 0;
export async function updateMusicNavigation() {
 const check = ++navigationCheck;
 const links = document.querySelectorAll<HTMLElement>('[data-owner-music]');
 links.forEach(link => { link.style.display = 'none'; });
 if (!getMusicSession()) return;
 try {
  const result = await musicApi<{owner: boolean}>('session');
  if (check === navigationCheck && result.owner) links.forEach(link => { link.style.removeProperty('display'); });
 } catch { /* Private navigation stays hidden until identity is verified. */ }
}
export function musicLogin(): Promise<MusicSession> {
 const auth = new URL('/auth', MUSIC_ORIGIN);
 auth.search = new URLSearchParams({ provider: 'github', site_id: location.hostname, purpose: 'music' }).toString();
 const popup = window.open(auth.href, 'airglow-music-login', 'popup,width=600,height=720');
 if (!popup) return Promise.reject(new Error('请允许本站弹出登录窗口，然后重试。'));
 return new Promise((resolve, reject) => {
  const cleanup = () => { window.removeEventListener('message', receive); clearInterval(timer); };
  const started = Date.now();
  const receive = (event: MessageEvent) => {
   if (event.origin !== new URL(MUSIC_ORIGIN).origin || event.source !== popup || typeof event.data !== 'string') return;
   if (event.data === 'authorizing:airglow-music') { popup.postMessage('authorizing:airglow-music', event.origin); return; }
   const prefix = 'authorization:airglow-music:';
   if (!event.data.startsWith(prefix)) return;
   try {
    const success = event.data.startsWith(`${prefix}success:`);
    const result = JSON.parse(event.data.slice(`${prefix}${success ? 'success' : 'error'}:`.length));
    cleanup(); popup.close();
    if (!success || !/^[\da-f]{64}$/.test(result.token) || result.expires <= Date.now()) reject(new Error(result.message || '登录失败，请使用博客所有者账号。'));
    else { saveMusicSession(result); resolve(result); }
   } catch { cleanup(); reject(new Error('登录响应无效，请重试。')); }
  };
  window.addEventListener('message', receive);
  const timer = setInterval(() => {
   if (popup.closed || Date.now() - started > 300000) { cleanup(); reject(new Error(popup.closed ? '登录窗口已关闭。' : '登录已超时，请重试。')); }
  }, 1000);
 });
}
