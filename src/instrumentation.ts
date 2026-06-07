export async function register() {
  // Alleen in de Node.js runtime (niet Edge), en niet tijdens builds
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler')
    startScheduler()
  }
}
