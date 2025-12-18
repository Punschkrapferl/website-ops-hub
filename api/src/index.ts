import { createApp } from "./app.js";
import { logger } from "./logger.js";

const port = 8080;

const app = createApp();
app.listen(port, () => {
    logger.info({ port }, "API listening");
});
