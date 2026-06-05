/* eslint-env node */

const cors = require("cors");
const express = require("express");
const { PORT } = require("./config");
const { errorHandler } = require("./middleware/errorHandler");
const apiRoutes = require("./routes/apiRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", apiRoutes);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Privy Stellar server: http://localhost:${PORT}`);
});
