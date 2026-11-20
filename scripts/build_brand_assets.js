/**
 * 随手读本 · HandyReader 官方品牌资产生成脚本
 */
const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '../docs/images');
const staticDir = path.join(__dirname, '../src/static');

if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
if (!fs.existsSync(staticDir)) fs.mkdirSync(staticDir, { recursive: true });

// 1. 官方主标：白底版 (logo-white-blue.svg)
const logoWhiteBlueSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <filter id="logo-w-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="22" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect x="20" y="20" width="472" height="472" rx="116" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="4"/>
  <g transform="translate(256, 256) rotate(-10) translate(-256, -256)">
    <rect x="134" y="105" width="231" height="297" rx="35" fill="#2B82F6" opacity="0.18"/>
  </g>
  <g transform="translate(256, 256) rotate(6) translate(-256, -256)" filter="url(#logo-w-shadow)">
    <rect x="146" y="107" width="231" height="297" rx="35" fill="#2B82F6"/>
    <path d="M 146, 142 C 146, 122 158, 107 178, 107 L 184, 107 L 184, 404 L 178, 404 C 158, 404 146, 389 146, 369 Z" fill="#1D4ED8" opacity="0.32"/>
    <line x1="184" y1="107" x2="184" y2="404" stroke="#1D4ED8" stroke-width="1.5" opacity="0.4"/>
    <line x1="186" y1="107" x2="186" y2="404" stroke="#93C5FD" stroke-width="1" opacity="0.4"/>
    <line x1="363" y1="135" x2="363" y2="376" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="6 4" opacity="0.75"/>
    <rect x="204" y="168" width="46" height="46" rx="13" fill="#FFFFFF"/>
    <rect x="260" y="170" width="88" height="20" rx="10" fill="#FFFFFF"/>
    <rect x="260" y="196" width="66" height="16" rx="8" fill="rgba(255, 255, 255, 0.8)"/>
    <rect x="204" y="242" width="144" height="17" rx="8.5" fill="rgba(255, 255, 255, 0.6)"/>
    <rect x="204" y="272" width="102" height="17" rx="8.5" fill="rgba(255, 255, 255, 0.35)"/>
  </g>
</svg>`;

// 2. 官方对照标：蓝底版 (logo-blue-white.svg)
const logoBlueWhiteSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <filter id="logo-b-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="22" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect x="20" y="20" width="472" height="472" rx="116" fill="#2B82F6"/>
  <g transform="translate(256, 256) rotate(-10) translate(-256, -256)">
    <rect x="134" y="105" width="231" height="297" rx="35" fill="#FFFFFF" opacity="0.22"/>
  </g>
  <g transform="translate(256, 256) rotate(6) translate(-256, -256)" filter="url(#logo-b-shadow)">
    <rect x="146" y="107" width="231" height="297" rx="35" fill="#FFFFFF"/>
    <path d="M 146, 142 C 146, 122 158, 107 178, 107 L 184, 107 L 184, 404 L 178, 404 C 158, 404 146, 389 146, 369 Z" fill="#E2E8F0" opacity="0.85"/>
    <line x1="184" y1="107" x2="184" y2="404" stroke="#CBD5E1" stroke-width="1.5" opacity="0.8"/>
    <line x1="363" y1="135" x2="363" y2="376" stroke="#2B82F6" stroke-width="2" stroke-dasharray="6 4" opacity="0.65"/>
    <rect x="204" y="168" width="46" height="46" rx="13" fill="#2B82F6"/>
    <rect x="260" y="170" width="88" height="20" rx="10" fill="#2B82F6"/>
    <rect x="260" y="196" width="66" height="16" rx="8" fill="rgba(43, 130, 246, 0.75)"/>
    <rect x="204" y="242" width="144" height="17" rx="8.5" fill="rgba(43, 130, 246, 0.55)"/>
    <rect x="204" y="272" width="102" height="17" rx="8.5" fill="rgba(43, 130, 246, 0.35)"/>
  </g>
</svg>`;

// 3. 官方微信圆形头像 (wechat-avatar.svg)
const wechatAvatarSvg = logoWhiteBlueSvg;

fs.writeFileSync(path.join(docsDir, 'logo-white-blue.svg'), logoWhiteBlueSvg, 'utf-8');
fs.writeFileSync(path.join(docsDir, 'logo-blue-white.svg'), logoBlueWhiteSvg, 'utf-8');
fs.writeFileSync(path.join(docsDir, 'wechat-avatar.svg'), wechatAvatarSvg, 'utf-8');

console.log('✅ Official Brand SVGs written successfully.');
