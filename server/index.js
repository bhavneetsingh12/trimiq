import cors from "cors";
import "dotenv/config";
import express from "express";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const app = express();
app.use(cors());
app.use(express.json());

const config = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaid = new PlaidApi(config);
console.log("PLAID_CLIENT_ID:", process.env.PLAID_CLIENT_ID);
console.log("PLAID_SECRET:", process.env.PLAID_SECRET ? "SET" : "MISSING");
console.log("PLAID_ENV:", process.env.PLAID_ENV);

app.post("/plaid/create_link_token", async (req, res) => {
  try {
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: "demo-user" },
      client_name: "TrimIQ",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/plaid/exchange_public_token", async (req, res) => {
  try {
    const { public_token } = req.body;
    const response = await plaid.itemPublicTokenExchange({ public_token });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(3001, "0.0.0.0", () => {
  console.log(
    "✅ Plaid server running on http://localhost:3001 (bound 0.0.0.0)",
  );
});
