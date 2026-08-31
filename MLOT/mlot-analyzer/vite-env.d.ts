/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Gemini API key, exposed from .env.local via envPrefix in vite.config.ts */
  readonly GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
