/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GAME_VERSION?: string;
  readonly VITE_SCORE_HMAC_SECRET?: string;
  readonly VITE_PHYSICS_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
