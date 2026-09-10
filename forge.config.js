const path = require('node:path')
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  // Forge 的打包逻辑会硬编码忽略项目根下的 /out/ 目录，
  // 因此本项目把 electron-vite 的构建产物输出到 app-build/，避开该忽略规则。
  // Forge 自身的输出（解包目录 + 安装包）写到 forge-dist/。
  outDir: 'forge-dist',
  packagerConfig: {
    asar: true,
    // exe 文件本身的图标（Windows 必须是 .ico）；不配则 exe 用 Electron 默认图标。
    // maker-squirrel 的 setupIcon 只管安装包图标，与此互不替代。
    icon: './resources/icon.ico',
    // 把 resources/ 复制进 <app>/resources/，供运行时读取
    // （windows.ts 里 process.resourcesPath/resources/icon.png、tray.png 的路径约定）
    extraResources: [{ from: './resources', to: 'resources' }],
  },
  rebuildConfig: {},
  makers: [
    {
      // 向导式安装（NSIS）：有许可页 + 可选安装目录，替代 Squirrel 的静默安装。
      // 底层为 electron-builder 的 app-builder NSIS 引擎。
      name: '@felixrieseberg/electron-forge-maker-nsis',
      config: {
        // 必须用函数形式返回（maker 以 getAppBuilderConfig() 取值）
        getAppBuilderConfig: () => ({
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
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
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
