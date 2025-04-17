import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

export default {
  packagerConfig: {
    asar: true,
    // --> Optional but recommended: Explicitly unpack ffmpeg-static if auto-unpack doesn't catch it
    // asar: {
    //   unpack: '**/node_modules/ffmpeg-static/**/*', // More specific: '**/node_modules/ffmpeg-static/ffmpeg*'
    // },
    // Explicitly specify architectures you might build (optional but good practice)
    arch: ['x64', 'arm64'],
    icon: './assets/icons/Drone', // no file extension required
    executableName: 'drone_desktop'
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'drone_desktop',
        iconUrl: 'https://raw.githubusercontent.com/DDA1O1/drone_desktop/main/assets/icons/Drone.ico',
        setupIcon: './assets/icons/Drone.ico',
        loadingGif: './assets/gif/loading.gif',
        setupExe: 'DroneDesktop-Setup.exe',
        noMsi: true,
        createDesktopShortcut: true,
        shortcutName: 'Drone Desktop'
      },
    },
    // {
    //   name: '@electron-forge/maker-zip',
    //   platforms: ['darwin'],
    // },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: './assets/icons/Drone.png',
          name: 'drone_desktop'
        }
      },
    },
    // {
    //   name: '@electron-forge/maker-rpm',
    //   config: {},
    // },
  ],
  plugins: [

    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    },
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'src/main/main.js',
            config: 'vite.main.config.mjs',
          },
          {
            entry: 'src/preload/preload.js',
            config: 'vite.preload.config.mjs',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
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
