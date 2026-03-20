import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import express from "express";

import requireFeature from "./requireFeature.js";

const router = express.Router();

// Server-side service role (bypasses RLS)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing SUPABASE_URL in server/.env");
if (!supabaseKey)
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY");

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "⚠️ export.js: using ANON key (dev mode). Set SERVICE_ROLE for prod.",
  );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ✅ Export subscriptions workbook
router.get(
  "/subscriptions.xlsx",
  requireFeature("export_excel"),
  async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).send("Not authenticated");

      const { data: subs, error } = await supabaseAdmin
        .from("subscriptions")
        .select(
          "display_name,cadence,avg_amount,last_charge_date,charge_count,confidence,ignored,canceled",
        )
        .eq("user_id", userId)
        .order("confidence", { ascending: false });

      if (error) return res.status(500).send(error.message);

      const workbook = new ExcelJS.Workbook();

      // Sheet 1: Subscriptions
      const ws1 = workbook.addWorksheet("Subscriptions");
      ws1.columns = [
        { header: "Merchant", key: "display_name", width: 28 },
        { header: "Cadence", key: "cadence", width: 12 },
        { header: "Avg Amount", key: "avg_amount", width: 12 },
        { header: "Last Charge", key: "last_charge_date", width: 14 },
        { header: "Charges", key: "charge_count", width: 10 },
        { header: "Confidence", key: "confidence", width: 12 },
      ];
      (subs || [])
        .filter((s) => !s.ignored && !s.canceled)
        .forEach((s) => ws1.addRow(s));

      // Sheet 2: Charge history (from transactions)
      const { data: txs } = await supabaseAdmin
        .from("transactions")
        .select("date,name,amount")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(2000);

      const ws2 = workbook.addWorksheet("Charge history");
      ws2.columns = [
        { header: "Merchant", key: "name", width: 28 },
        { header: "Date", key: "date", width: 14 },
        { header: "Amount", key: "amount", width: 12 },
      ];
      (txs || []).forEach((t) => ws2.addRow(t));

      // Sheet 3: Ignored/Cancelled
      const ws3 = workbook.addWorksheet("Ignored_Cancelled");
      ws3.columns = [
        { header: "Merchant", key: "display_name", width: 28 },
        { header: "Ignored", key: "ignored", width: 10 },
        { header: "Canceled", key: "canceled", width: 10 },
      ];
      (subs || [])
        .filter((s) => s.ignored || s.canceled)
        .forEach((s) => ws3.addRow(s));

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="subscriptions.xlsx"`,
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (e) {
      res.status(500).send(String(e));
    }
  },
);

export default router;
