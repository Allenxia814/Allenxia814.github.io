import type { ExpressiveCodeConfig, LicenseConfig, NavBarConfig, ProfileConfig, SiteConfig } from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
  title: "Airglow",
  subtitle: "记录技术、灵感与日常的微光",
  lang: "zh_CN",
  themeColor: { hue: 185, fixed: true },
  banner: {
    enable: true,
    src: "/images/airglow-night.webp",
    position: "center",
    credit: { enable: false, text: "", url: "" },
  },
  toc: { enable: true, depth: 2 },
  favicon: [{ src: "/favicon/airglow.svg", sizes: "any" }],
};
export const navBarConfig: NavBarConfig = {
  links: [LinkPreset.Home, LinkPreset.Archive, LinkPreset.About],
};
export const profileConfig: ProfileConfig = {
  avatar: "/favicon/airglow.svg",
  name: "Airglow",
  bio: "记录技术、灵感与日常的微光。",
  links: [],
};
// Article permissions can be selected before publishing real posts.
export const licenseConfig: LicenseConfig = {
  enable: false, name: "CC BY-NC-SA 4.0", url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};
export const expressiveCodeConfig: ExpressiveCodeConfig = { theme: "github-dark" };
