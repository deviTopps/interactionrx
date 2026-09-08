import app from './app.js';

const PORT = process.env.PORT || 4000;

// On Vercel the platform invokes the exported app; do not bind a port.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`InteractionRX API running on http://localhost:${PORT}`);
  });
}

export default app;
