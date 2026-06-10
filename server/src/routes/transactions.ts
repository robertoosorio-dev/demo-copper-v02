import { Router } from "express";
import type { ProjectStore } from "../store.js";

export function makeTransactionsRouter(store: ProjectStore): Router {
  const router = Router();

  // GET /api/projects/:id/versions/:ver/transactions — list transaction passes for a version
  router.get("/:id/versions/:ver/transactions", async (req, res) => {
    try {
      const passes = await store.listTransactionPasses(req.params.id, Number(req.params.ver));
      res.json(passes);
    } catch (err) {
      console.error("[transactions] list passes failed:", (err as Error).message);
      res.status(500).json({ error: "Failed to list transactions" });
    }
  });

  // GET /api/projects/:id/versions/:ver/transactions/:pass — list reasoning log entries for a pass
  router.get("/:id/versions/:ver/transactions/:pass", async (req, res) => {
    try {
      const entries = await store.listReasoningEntries(
        req.params.id,
        Number(req.params.ver),
        req.params.pass,
      );
      res.json(entries);
    } catch (err) {
      console.error("[transactions] list entries failed:", (err as Error).message);
      res.status(500).json({ error: "Failed to list reasoning entries" });
    }
  });

  return router;
}
