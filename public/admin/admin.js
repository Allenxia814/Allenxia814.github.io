window.CMS_MANUAL_INIT = true;

(async () => {
  const status = document.getElementById("status");
  try {
    const response = await fetch("/admin/config.json");
    if (!response.ok) throw new Error("无法读取后台配置");
    const settings = await response.json();
    if (!settings.configured) {
      status.textContent = "后台登录尚未配置。完成 GitHub OAuth 服务设置后，即可在这里登录写作。";
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/decap-cms@3.16.3/dist/decap-cms.js";
    script.onload = () => {
      try {
        window.CMS.init({ config: settings.config });
        document.documentElement.classList.add("cms-ready");
        document.getElementById("admin-status").hidden = true;
      } catch {
        status.textContent = "编辑器启动失败，请检查后台配置并刷新重试。";
      }
    };
    script.onerror = () => { status.textContent = "编辑器加载失败，请刷新重试。"; };
    document.head.appendChild(script);
  } catch {
    status.textContent = "后台配置加载失败，请刷新重试。";
  }
})();
