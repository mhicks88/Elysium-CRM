import { createServer } from "./server";

async function main() {
  try {
    const port = Number(process.env.PORT) || 4000;

    const app = createServer();

    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`API listening on port ${port}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

main();
