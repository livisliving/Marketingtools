/// <reference types="vite/client" />

// Injected at build time via Vite `define` (see vite.config.ts) from package.json.
declare const __APP_VERSION__: string;
// False in single-file/offline builds — disables the update poll.
declare const __UPDATE_CHECK__: boolean;
