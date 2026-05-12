/** Límites de throttle para auth; se resuelven una vez al cargar el módulo. */
function throttlePair(
  limitEnv: string | undefined,
  ttlMsEnv: string | undefined,
  defaultLimit: number,
  defaultTtlMs: number,
): { limit: number; ttl: number } {
  return {
    limit: Number(limitEnv ?? defaultLimit),
    ttl: Number(ttlMsEnv ?? defaultTtlMs),
  };
}

export const AUTH_THROTTLE = {
  login: throttlePair(
    process.env.THROTTLE_LOGIN_LIMIT,
    process.env.THROTTLE_LOGIN_TTL_MS,
    5,
    60_000,
  ),
  pin: throttlePair(
    process.env.THROTTLE_PIN_LIMIT,
    process.env.THROTTLE_PIN_TTL_MS,
    5,
    60_000,
  ),
  recuperacion: throttlePair(
    process.env.THROTTLE_RECUPERACION_LIMIT,
    process.env.THROTTLE_RECUPERACION_TTL_MS,
    2,
    60_000,
  ),
  recuperacionConfirmacion: throttlePair(
    process.env.THROTTLE_RECUPERACION_CONFIRMACION_LIMIT,
    process.env.THROTTLE_RECUPERACION_CONFIRMACION_TTL_MS,
    5,
    60_000,
  ),
  verify: throttlePair(
    process.env.THROTTLE_VERIFY_LIMIT,
    process.env.THROTTLE_VERIFY_TTL_MS,
    3,
    60_000,
  ),
  refresh: throttlePair(
    process.env.THROTTLE_REFRESH_LIMIT,
    process.env.THROTTLE_REFRESH_TTL_MS,
    5,
    60_000,
  ),
  logout: throttlePair(
    process.env.THROTTLE_LOGOUT_LIMIT,
    process.env.THROTTLE_LOGOUT_TTL_MS,
    5,
    60_000,
  ),
  resetPassword: throttlePair(
    process.env.THROTTLE_RESET_PASSWORD_LIMIT,
    process.env.THROTTLE_RESET_PASSWORD_TTL_MS,
    5,
    60_000,
  ),
  pasajeroRegistro: throttlePair(
    process.env.THROTTLE_PASAJERO_REGISTRO_LIMIT,
    process.env.THROTTLE_PASAJERO_REGISTRO_TTL_MS,
    5,
    60_000,
  ),
  validateFace: throttlePair(
    process.env.THROTTLE_VALIDATE_FACE_LIMIT,
    process.env.THROTTLE_VALIDATE_FACE_TTL_MS,
    5,
    60_000,
  ),
};
