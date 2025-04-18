import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import ffmpegStaticPath from 'ffmpeg-static';

if (!ffmpegStaticPath) {
  throw new Error('Could not resolve ffmpeg-static path. Is it installed?');
}
console.log(`[Forge Config] Found ffmpeg-static executable at: ${ffmpegStaticPath}`);

export default {
  packagerConfig: {
    asar: true,
    icon: './assets/icons/Drone',
    executableName: 'drone_desktop',
    // --- USE extraResource INSTEAD OF HOOK ---
    extraResource: [
      ffmpegStaticPath // Provide the path to the file to include
    ],
    // ---
  },
  rebuildConfig: {},
  // --- REMOVE THE HOOK ENTIRELY ---
  // hooks: {
  //   async packageAfterCopy(...) { /* ... */ }
  // },
  // ---
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
        build: [
          {
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
