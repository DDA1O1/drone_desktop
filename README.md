# Electron-Vite-React Boilerplate

A modern boilerplate for building cross-platform desktop applications using Electron, Vite, React, and TailwindCSS.

## Features

- ⚡️ Built with Vite for blazing-fast development
- ⚛️ React for the UI framework
- 🎨 TailwindCSS pre-configured for styling
- 🔥 Hot Module Replacement (HMR)
- 🖥️ Electron for cross-platform desktop apps
- 📦 Easy packaging and distribution
- 🚀 Production ready setup

## Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

## Getting Started

1. Clone this repository or use it as a template
2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

## Available Scripts

- `npm start` - Start the application in development mode
- `npm run package` - Package the application
- `npm run make` - Create distributable packages for your platform
- `npm run publish` - Publish your application

## Project Structure

```
├── .github/
│   └── workflows/
│       └── release.yml    # GitHub Actions workflow for releases
├── src/
│   ├── main.js           # Electron main process
│   ├── preload.js        # Preload script
│   ├── main.jsx          # React entry point
│   ├── App.jsx           # Main React component
│   └── index.css         # Global styles
├── .gitignore            # Git ignore configuration
├── forge.config.js       # Electron Forge config
├── index.html            # HTML entry point
├── package.json          # Project dependencies and scripts
├── package-lock.json     # Lock file for dependencies
├── vite.main.config.mjs      # Vite config for main process
├── vite.preload.config.mjs   # Vite config for preload script
└── vite.renderer.config.mjs  # Vite config for renderer process
```

## Technologies

- [Electron](https://www.electronjs.org/)
- [Vite](https://vitejs.dev/)
- [React](https://reactjs.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Electron Forge](https://www.electronforge.io/)

## License

MIT

---

This project uses Electron Forge for building and packaging. For more information on customizing your build, check out the [Electron Forge documentation](https://www.electronforge.io/).