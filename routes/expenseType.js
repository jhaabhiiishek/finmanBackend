import express from "express"
const router = express.Router();
import ExpenseType from "../models/expenseType.js"

// Get all expense types
router.get("/", async (req, res) => {
  try {
    const types = await ExpenseType.find();
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// Add a new expense type
router.post("/", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Expense type is required" });
  }

  try {
    const newType = new ExpenseType({ name });
    await newType.save();
    res.status(201).json(newType);
  } catch (err) {
    res.status(500).json({ error: "Could not save expense type" });
  }
});

export default router;