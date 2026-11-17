const instance = () =>
  process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || "local";

/** Logs only operational metadata. Never pass cookie values or credentials here. */
export function logAdminSession(event, details = {}) {
  console.info(
    JSON.stringify({
      component: "master-admin-session",
      event,
      instance: instance(),
      dbReadyState: details.dbReadyState,
      ...details,
    }),
  );
}
