export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureWorker } = await import("./lib/worker-start");
    ensureWorker();
  }
}
