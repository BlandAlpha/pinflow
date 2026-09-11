const path = require('node:path')
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

// 应用内更新的源地址（客户端会去拉 `${UPDATE_BASE_URL}/latest.yml`）。
// 它被写进随包分发的 resources/app-update.yml，运行时不可改，所以必须构建时定。
// CI 里由仓库变量 UPDATE_BASE_URL 注入；本地打包不设就落到占位值，
// 装出来的包其它功能都正常，只是「检查更新」会连不上。
const UPDATE_BASE_URL = process.env.UPDATE_BASE_URL || 'https://dl.example.com/todo-tracker'

// 打包参数是静态对象，平台差异（图标格式、bundle id、产品名）在这里一次性算好
const isMac = process.platform === 'darwin'

module.exports = {
  // Forge 的打包逻辑会硬编码忽略项目根下的 /out/ 目录，
  // 因此本项目把 electron-vite 的构建产物输出到 app-build/，避开该忽略规则。
  // Forge 自身的输出（解包目录 + 安装包）写到 forge-dist/。
  //
  // FORGE_OUT_DIR 是本地验证用的逃生口：Windows 上 forge-dist 里的 app.asar
  // 常被 Defender/索引进程短暂占用，导致 Forge 清目录时报「另一个进程正在使用此文件」。
  // 换个空目录就能照常验证构建，不必动已发布产物。CI 不设该变量，走默认值。
  outDir: process.env.FORGE_OUT_DIR || 'forge-dist',
  packagerConfig: {
    asar: true,
    // 产品名：macOS 上用带空格的显示名（决定 .app 包名、菜单栏第一项与 userData 目录），
    // Windows / Linux 保持短横线形式，免安装版路径与 CI 收集逻辑不受影响
    name: isMac ? 'Todo Tracker' : 'todo-tracker',
    // macOS 必需：通知、登录项、系统设置里的应用标识都靠它
    appBundleId: 'com.canisalpha.todo-tracker',
    appCategoryType: 'public.app-category.productivity',
    // 图标格式各平台互不通用：Windows 只认 .ico，macOS 只认 .icns
    // （.icns 由 scripts/make-icons.mjs 在 macOS 上生成，非 mac 平台打包 mac 版会缺图标）
    icon: isMac ? './resources/icon.icns' : './resources/icon.ico',
    // 把 resources/ 复制进 <app>/resources/resources/，供运行时读取
    // （windows.ts 里 process.resourcesPath/resources/icon.png、tray.png 的路径约定）
    //
    // 两个坑（@electron/packager 18）：
    // 1. 键名是单数 extraResource，写成复数会被静默忽略（不报错，图标就是不进包）；
    // 2. 只接受字符串路径，复制目标是 resources/<basename>，
    //    不支持 { from, to } 对象（那是 electron-builder 的写法，传了会直接抛错）。
    extraResource: ['./resources'],
    // Forge 的默认值只有 [/^\/out\//g]，而本项目把产物放在 forge-dist/ 和 app-build/。
    // 不显式忽略的话，第二次 make 会把上一次的安装包（近百 MB）连同 .smoke 里的
    // 截图与旧产物一起塞进 app.asar —— 实测把 asar 撑到 823 MB，安装包 553 MB。
    // 注意：设置了 ignore 就会**替换**默认值，所以 /^\/out\// 必须自己带上。
    ignore: [
      /^\/out\//g,
      /^\/forge-dist\//g,
      /^\/\.smoke\//g,
      /^\/\.git\//g,
      /^\/\.github\//g,
      /^\/\.workbuddy\//g,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      // 向导式安装（NSIS）：有许可页 + 可选安装目录，替代 Squirrel 的静默安装。
      // 底层为 electron-builder 的 app-builder NSIS 引擎。
      //
      // platforms 必须显式限定：Forge 对没写 platforms 的 maker 视为「支持所有平台」，
      // 于是在 macOS / Linux 上跑 npm run make 也会去启动 NSIS 引擎，然后必然失败。
      name: '@felixrieseberg/electron-forge-maker-nsis',
      platforms: ['win32'],
      config: {
        // 应用内更新：这个 maker 会据此生成两份文件
        // 1) 打进包里的 resources/app-update.yml（provider / url / channel）
        // 2) 与安装包并排的 latest.yml（版本号 + 安装包 sha512/size）
        // 两者缺一不可：前者告诉客户端去哪查，后者是客户端比对版本的依据。
        // 刻意不设 publisherName —— 设了 electron-updater 会强制校验代码签名，
        // 而我们暂未签名，会导致更新被拒。
        updater: {
          url: UPDATE_BASE_URL,
          name: 'Todo Tracker',
          channel: 'latest',
          updaterCacheDirName: 'todo-tracker-updater',
        },
        // 必须用函数形式返回（maker 以 getAppBuilderConfig() 取值）
        getAppBuilderConfig: () => ({
          // 安装包名去空格：latest.yml 里的 url 会被客户端按 URL 使用，
          // 「Setup 0.1.0.exe」带空格和点号容易在各类代理/网关处出岔子。
          artifactName: 'todo-tracker-${version}-setup.${ext}',
          // 必须显式声明 publish：不声明时 electron-builder 在 CI 环境会自动套用
          // 「onTagOrDraft」策略，进而去推断 GitHub publisher，缺少 GH_TOKEN 就直接抛错中断构建。
          //
          // 为什么选 generic：它对 electron-builder 来说「有配置但无 publisher」
          // （createPublisher 对 generic 返回 null），于是只打印一句 not published 就放过，
          // 而 latest.yml / app-update.yml 仍会正常生成 —— 这点很重要，
          // 若改成 publish: null 则会连 publishConfigs 一起没有，latest.yml 就不会生成了。
          // 真正的上传交给 workflow 里的 aws s3 cp（R2）。
          publish: {
            provider: 'generic',
            url: UPDATE_BASE_URL,
            channel: 'latest'
          },
          // NSIS 的安装 / 卸载程序图标走 electron-builder 的 win.icon；
          // 不配的话日志会提示 "default Electron icon is used"，安装包是 Electron 默认图标
          // （packagerConfig.icon 只管包内那个 exe，两者不互相替代）。
          win: {
            icon: path.resolve(__dirname, 'resources/icon.ico'),
          },
          // 注意：这些键都属于 nsis 层（electron-builder 顶层不接受 license /
          // installerLanguages）；且 license 必须用绝对路径 —— 构建时 app-builder
          // 的工作目录是临时打包目录，相对路径会找不到 EULA。
          nsis: {
            license: path.resolve(__dirname, 'LICENSE.txt'),
            // 简体中文向导（英文 UI 时 EULA 里的中文在 unicode 下同样正常显示）
            installerLanguages: ['zh_CN'],
            // 关掉一键静默安装，才有向导与许可页
            oneClick: false,
            // 仅当前用户安装：不需要管理员权限，装到 %LOCALAPPDATA%\Programs
            perMachine: false,
            allowToChangeInstallationDirectory: true,
            allowElevation: true,
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
            shortcutName: 'Todo Tracker',
            uninstallDisplayName: 'Todo Tracker',
            // 卸载时保留用户数据：任务都在本地库里，不能跟着卸载一起没了
            deleteAppDataOnUninstall: false,
            displayLanguageSelector: false,
          },
        }),
      },
    },
    {
      // macOS 分发产物：Todo Tracker.app 的 zip 包（未签名，首次打开需右键 → 打开）
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      platforms: ['linux'],
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
