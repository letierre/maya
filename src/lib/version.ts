/** Versão atual do app (semver) — atualize aqui a cada release. */
export const APP_VERSION = "2.0.0";

/**
 * Identificador do build carregado no cliente — muda a cada deploy (git SHA).
 * O VersionGuard compara com /api/version p/ forçar recarga quando há deploy
 * novo. Em dev local é "local" (igual ao /api/version), então não recarrega.
 */
export const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION || "local";
