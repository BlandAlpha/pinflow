# 发布流程（版本 / 构建 / 分发 / 应用内更新）

面向「打一个 tag，剩下的交给 CI」的商业化迭代流程。
本地只需一条命令发版，构建、签名前处理、上传更新源、建 Release 全部自动完成。

---

## 1. 全貌

```
本地 npm run release:patch
        │
        ├─ 改 package.json 版本 + git commit + git tag v0.1.1
        │
        └─ git push --follow-tags
                 │
                 ▼
      GitHub Actions: .github/workflows/release.yml
                 │
                 ├─ 校验 tag 与 package.json 版本一致（不一致直接失败）
                 ├─ typecheck + 单元测试
                 ├─ fetch-native（换成 Electron ABI 的 better-sqlite3）
                 ├─ npm run make（注入 UPDATE_BASE_URL）
                 │     └─ 产出：安装包 + .blockmap + latest.yml
                 ├─ 上传到 Cloudflare R2（exe/blockmap 先传，latest.yml 最后传）
                 ├─ 存档 Action Artifacts（R2 没配好时产物不丢）
                 └─ 创建 GitHub Release（变更记录 + 备份下载）
                          │
                          ▼
              客户端启动 8 秒后静默检查
                        设置 → 更新 / 托盘右键「检查更新…」
```

**代码库私有，安装包公开可下载**：客户端只从 R2 读一个 `latest.yml` 再下安装包，
不需要任何密钥（这也是不把 Release 放在私有仓库、直接内置 token 的原因——token 可被逆向提取）。

---

## 2. 版本号规则

`package.json` 的 `version` 是**唯一**版本来源，tag 必须与它一致（CI 会强制校验）。

| 场景 | 命令 | 版本变化 | 适用 |
| --- | --- | --- | --- |
| 修 bug / 小改动 | `npm run release:patch` | 0.1.0 → 0.1.1 | 绝大多数迭代 |
| 加了新功能 | `npm run release:minor` | 0.1.1 → 0.2.0 | 里程碑 |
| 不兼容改动 | `npm run release:major` | 0.2.0 → 1.0.0 | 正式版 / 数据结构不兼容 |

这三条命令做三件事：改版本号 → 提交 → 打 `v*` tag。然后：

```bash
git push --follow-tags     # 触发 CI 发布
```

> 千万别手改 `package.json` 版本号再单独打 tag —— tag 与版本号不一致时 CI 会直接失败，
> 因为版本号不一致会让客户端陷入「提示更新 → 装完还是旧版 → 又提示更新」的死循环。

---

## 3. 首次配置（只做一次）

### 3.1 建私有仓库并推上去

```bash
cd "D:/leo/TODO Tracker"
git remote add origin git@github.com:<你的账号>/todo-tracker.git
git push -u origin master
```

### 3.2 建 Cloudflare R2 桶并绑自定义域名

1. Cloudflare 控制台 → **R2** → 创建存储桶（名字如 `todo-dl`）。
   开通 R2 需要绑一张卡，但在免费额度内不扣费：**存储 10 GB/月、出站流量永久免费无限**。
2. 桶 → **Settings** → **Public access** → 绑定你的域名，得到形如
   `https://dl.你的域名.com` 的地址（这一步不用备案域名，Cloudflare 会自动发证书）。
3. 桶 → **Settings** → **API Tokens** → 创建 R2 API Token，
   权限选 **Object Read & Write**，记下 `Access Key ID` / `Secret Access Key`
   和账号 ID（控制台 R2 概览页右侧 Account ID）。
4. 把 `UPDATE_BASE_URL` 定为桶的**根地址**，客户端会去拉 `${UPDATE_BASE_URL}/latest.yml`。
   例如 `https://dl.你的域名.com`。

> 92 MB 安装包在 10 GB 免费存储下约可存 **100 个历史版本**，不用急着清理。
> 需要腾空间时删掉旧的 `todo-tracker-<版本>-setup.exe` 与同名 `.blockmap` 即可，
> 当前版本对应的两个文件（以及 `latest.yml`）**不能删**。

### 3.3 在 GitHub 配好变量与密钥

仓库 → Settings → Secrets and variables → Actions：

| 类型 | 名称 | 值 |
| --- | --- | --- |
| Variables | `UPDATE_BASE_URL` | `https://dl.你的域名.com`（R2 绑定的域名，**结尾不要带 `/`**） |
| Variables | `R2_BUCKET` | 桶名，如 `todo-dl` |
| Secrets | `R2_ACCOUNT_ID` | Cloudflare 账号 ID |
| Secrets | `R2_ACCESS_KEY_ID` | R2 API Token 的 Access Key ID |
| Secrets | `R2_SECRET_ACCESS_KEY` | R2 API Token 的 Secret Access Key |

变量（Variables）要填 `UPDATE_BASE_URL`：它会被注入到构建里，
写进随包分发的 `resources/app-update.yml`，因此**发布后想换 CDN 必须重新构建发版**。

**没配 R2 也能跑通流程**：上传步骤会跳过并给出警告，产物留在 Action Artifacts
与 GitHub Release 里，用于先验证构建链路。

---

## 4. 日常发版

```bash
git add -A
git commit -m "feat(xxx): ..."      # 中文 commit message
npm run release:patch               # 或 minor / major
git push --follow-tags
```

`git push --follow-tags` 之后打开 Actions 页面看 `Release` 工作流；
绿色通过后，R2 上的 `latest.yml` 已经被替换成新版本，
**老客户端启动 8 秒后就会看到更新提示**。

### 想单独验证链路（不发布新版本）

Actions → Release → **Run workflow**（workflow_dispatch）：
用当前 `package.json` 的版本重新构建并上传，适合上次上传失败的重试。版本号不会变。

---

## 5. 客户端更新行为（已实现）

| 行为 | 说明 |
| --- | --- |
| 自动检查 | 启动后延迟 8 秒静默检查一次，不打扰 |
| 手动检查 | 设置 → 更新；或托盘右键 → 「检查更新…」（结果走系统通知） |
| 下载 | **不自动下载**，用户点「下载更新」才开始（弱网/流量环境友好） |
| 进度 | 设置面板显示百分比与进度条 |
| 安装 | 「重启并安装」→ 静默安装（NSIS 带 `/S`）→ 自动拉起新版本 |
| 退出兜底 | 已下载但直接退出应用时，也会顺手装上（`autoInstallOnAppQuit`） |
| 不可用场景 | 源码态（`npm run dev`）与免安装版（`npm run package`）如实显示「不支持」 |

实现位置：

| 文件 | 职责 |
| --- | --- |
| `electron/main/updater.ts` | 状态机 + electron-updater 装配（唯一写状态的地方） |
| `forge.config.js` → nsis maker `updater` | 生成 `app-update.yml`（包内）与 `latest.yml`（安装包旁） |
| `electron/main/ipc.ts` | 4 个 IPC 通道：取状态 / 检查 / 下载 / 安装 |
| `src/components/layout/SettingsDialog.tsx` | 设置面板「更新」分组 |
| `electron/main/tray.ts` | 托盘菜单「检查更新…」，菜单文案跟随状态 |

### 为什么免安装版不支持更新

`app-update.yml` 是由 **maker 在打安装包时**写进包里的，
`npm run package` 产出的免安装目录没有这个文件，electron-updater 会直接报 ENOENT。
所以代码里用「已打包 **且** `app-update.yml` 存在」双重判断，如实显示不可用，
而不是让用户点完按钮收到一串报错。

---

## 6. 排障

| 现象 | 原因 / 处理 |
| --- | --- |
| 客户端一直显示「已是最新版本」 | 检查 `https://<UPDATE_BASE_URL>/latest.yml` 是否可公开访问（浏览器直接打开应返回 YAML 文本） |
| 「更新源上还没有发布版本」（404） | R2 桶里没有 `latest.yml`，或 `UPDATE_BASE_URL` 写错 / 结尾多了 `/` |
| 提示更新但下载 404 | `latest.yml` 里的 `url` 与桶里的安装包名不一致 —— 通常是手工改过 `artifactName` |
| 下载后 SHA512 校验失败 | 上传不完整，重跑 `Release` 工作流 |
| 更新装完版本没变 | `package.json` 版本与 tag 不一致（CI 本该拦住）；检查是否手工打过 tag |
| Actions 里 R2 上传报 400 | aws-cli 的校验头问题，工作流已设 `AWS_REQUEST_CHECKSUM_CALCULATION=when_required`；若仍失败改用 `rclone` |
| 设置面板显示「不支持自动更新」 | 当前跑的是开发版或免安装版，属预期行为；请用安装包装出来的版本验证 |

---

## 7. 后续可加（本期未做）

- **Windows 代码签名**：签了之后静默更新体验更完整，也不会再弹 SmartScreen。
  接入点已经留好：`forge.config.js` 的 nsis maker 支持 `config.codesign`
  （`certificateFile` + `certificatePassword`），并在生成 `app-update.yml` 时传 `publisherName`
  —— 注意**设了 `publisherName` 就会强制校验签名**，必须与签名一起开。
- **macOS 分发**：`npm run make` 已能在 mac 上产出 `Todo Tracker.app` 的 zip（maker-zip，
  `platforms: ['darwin']`；未签名，首次打开需「右键 → 打开」）。要做到应用内更新（`latest-mac.yml`）
  与免提示安装，需要 Apple 开发者证书签名 + 公证，再把 macOS 的构建 job 并入本发布流程。
- **Linux 分发**：`forge.config.js` 里 deb / rpm maker 已限定 `platforms: ['linux']`，
  补一个 Linux CI job 即可。
- **灰度发布 / 多通道**：maker 的 `updater.channel` 支持切成 `beta`，
  客户端按 channel 读 `beta.yml`，可实现内测通道。
