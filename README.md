<div align="center">

<img src="docs/images/wechat-mp-qrcode.jpg" width="140" alt="随手读本 小程序码" style="border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.1);" />

# 随手读本 · HandyReader

**⚡ 开源 · 零广告 · 免登录 · 纯离线 · 打开即读**
<br/>
<sub>一款回归原著阅读本质的极简英文名著物理翻卡精读微信小程序</sub>

<p align="center">
  <a href="https://mp.weixin.qq.com/"><img src="https://img.shields.io/badge/Platform-WeChat%20MiniProgram-07C160?style=flat-square&logo=wechat&logoColor=white" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-CC%20BY--NC%204.0-red?style=flat-square" /></a>
  <a href="docs/BRAND.md"><img src="https://img.shields.io/badge/Brand-Design%20Assets-8250df?style=flat-square" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Features-无广告%20%7C%20免登录%20%7C%20纯离线-orange?style=flat-square" /></a>
  <a href="#-快速开始与自主部署"><img src="https://img.shields.io/badge/Architecture-25部名著全内置%20%7C%20主包600KB-success?style=flat-square" /></a>
</p>

</div>

---

## ✨ 核心亮点

- ⚡ **开屏即读**：零商业广告插播、免登录注册、无强制社交绑定，打开就是纯粹沉浸的名著精读。
- 📦 **真 · 纯离线**：全部 25 部世界公版文学经典全部本地内置打包，断网飞行模式、地铁通勤阅读零阻碍。
- 🃏 **指尖翻卡流（Physical Deck）**：段落级卡片物理堆叠翻页，向上滑动顺滑切入下一段，向下滑动翻回上一段，像刷短视频一样无压力读完大部头。
- 💡 **轻触自然即时查词**：轻点正文任意生词瞬间弹出轻量气泡，包含当前语境释义与真人原声音频发音，告别打断沉浸感的全屏弹窗。
- 🌐 **段落中英折叠译文**：段落级精准双语对照，一键平滑展开/收起精校地道人工译文，扫除阅读理解死角。
- 🎨 **四款经典纸感护眼主题**：纯净暖白（Clean Light）、温润羊皮纸（Parchment）、沉浸墨黑（Midnight Dark）、柔和米青（Soft Celadon），四档字号自适应缩放。
- 📚 **25 部传世文学名篇**：科学划分为【入门级】、【进阶级】、【挑战级】三大阶梯，从安徒生、王尔德童话，到欧·亨利、柯南·道尔、爱伦·坡、卡夫卡传世名著。
- 🎉 **物理完读成就卡（第 N+1 张卡片）**：全篇精读完成时，作为第 N+1 张实体卡片伴随震动与立体翻卡动效飞入中央，3D 实体书封 + 单行成就指标 + 一键微信分享。
- 🍃 **极致轻量架构**：25 部完整名著打包后总体积仅 **0.62 MB**（远低于微信 2MB 限制），首屏毫秒级极速冷启动。

---

## 📱 视觉与分享展示

<div align="center">
  <img src="docs/images/share-cover.jpg" width="560" alt="随手读本 官方精装分享卡片" style="border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 8px; border: 1px solid #e2e8f0;" />
  <br/>
  <sub><b>随手读本 · HandyReader 官方 5:4 黄金比例微信分享卡片（存储于 <code>src/static/share-cover.jpg</code>）</b></sub>
</div>

---

## 📖 精选世界名著读本库

全部 25 部读本均精选自国际公共版权领域（Public Domain），按难度严谨科学分级内置于 `src/data/` 目录中：

| 难度阶梯 | 收录数量 | 代表名作 | 词数区间 | 核心题材与适读人群 |
| :--- | :---: | :--- | :---: | :--- |
| 🟢 **入门级** | 6 部 | 《卖火柴的小女孩》《快乐王子》《自私的巨人》《夜莺与玫瑰》等 | 1,100 ~ 2,400 词 | 安徒生、王尔德经典童话 · 初高中/四级基础 |
| 🟡 **进阶级** | 10 部 | 《麦琪的礼物》《最后一片叶子》《警察与赞美诗》《二十年后》等 | 1,300 ~ 4,800 词 | 欧·亨利反转、爱伦·坡心理惊悚、莫泊桑讽刺 · 四六级/考研 |
| 🔴 **挑战级** | 9 部 | 《波希米亚丑闻》《变形记》《化身博士》《百万英镑》《返老还童》等 | 7,200 ~ 25,500 词 | 福尔摩斯推理、卡夫卡存在主义、人性双重分裂 · 六级+/托福雅思 |

> 💡 **全量书单与离线数据**：全部 25 部小说的分段双语对照与生词数据均内置打包于 [`src/data/catalog.json`](src/data/catalog.json)，无需额外联网下载。

---

## 🚀 快速开始与自主部署

只需一个个人微信小程序账号，即可发布属于你自己的专属私有名著精读应用：

### 1. 克隆与安装

```bash
git clone https://github.com/lanzm/HandyReader.git
cd HandyReader
pnpm install   # 或 npm install
```

### 2. 本地开发与实时预览

```bash
pnpm run dev:mp-weixin
```
打开 **微信开发者工具** -> 点击「导入」 -> 选择项目目录下的 `dist/dev/mp-weixin` 即可实时热重载预览。

### 3. 构建发布生产包

```bash
pnpm run build:mp-weixin
```
编译产物位于 `dist/build/mp-weixin`（总包体积仅 **0.62 MB**，严格契合微信 2MB 规范，微信开发者工具上传 0 报错）。在微信开发者工具中导入后，点击右上角 **「上传」** 提交微信审核即可。

### 4. 语音发音服务器域名配置

若需在生产环境中正常使用在线真人原声发音，请在 [微信公众平台](https://mp.weixin.qq.com/) 的 **「开发管理 -> 开发设置 -> 服务器域名 -> request 合法域名」** 中添加：
```text
https://dict.youdao.com
```

---

## 🎨 品牌与视觉资产

随手读本的官方 Logo、全套 1.18x 饱满矢量 SVG、纯白底微信圆形头像及 5:4 官方分享封面规范详见 **[🎨 docs/BRAND.md 品牌设计规范](docs/BRAND.md)**。

> ⚠️ **版权与独占声明**：「随手读本」与「HandyReader」名称、官方 Logo、UI 视觉设计语言专属于原作者独家所有，严禁未经授权用于商业仿冒、换皮牟利或冒用官方名义。

---

## 🤝 开源与版权协议

本项目遵循 **[CC BY-NC 4.0（知识共享-署名-非商业性使用 4.0 国际许可）](LICENSE)** 协议开源：

- ✅ **个人免费学习研究**：允许个人学习研究、技术交流及个人部署自用；
- ❌ **严禁商业营利变现**：**严禁任何个人或机构将本项目代码打包转售、上架付费应用、或二次植入商业广告（包括但不限于小程序流量主各类广告）上线变现**；
- ❌ **严禁品牌仿冒**：未经书面授权，不得使用「随手读本」或「HandyReader」的品牌名称与 Logo 进行二次分发，保留依法追究侵权下架之权利。

---

### ❤️ 支持与体验官方版

官方小程序永久秉持 **纯粹 · 零广告 · 免登录 · 纯离线**，欢迎微信扫码体验！

如果随手读本在你的英文阅读和文学提升中有所启发，欢迎在 GitHub 点个 **Star ⭐️** 支持作者，也欢迎分享给身边热爱英文原著的小伙伴！
