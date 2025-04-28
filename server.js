import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import expenseTypeRoutes from "./routes/expenseType.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// User Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: String,
  balance: Number,
  transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }],
});
const User = mongoose.model("User", UserSchema);

// Transaction Schema
const TransactionSchema = new mongoose.Schema({
  senderEmail: String,
  receiverEmail: String,
  date: { type: Date, default: Date.now },
  description: String,
  category: String,
  amount: Number,
});
const Transaction = mongoose.model("Transaction", TransactionSchema);

// Expense Model
const ExpenseSchema = new mongoose.Schema({
  userEmail: String,
  expenseType: String,
  recipient: String,
  amount: Number,
  remarks: String,
  date: { type: Date, default: Date.now },
});
const Expense = mongoose.model("Expense", ExpenseSchema);

// Signup Route
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, balance: 1000 });
    await user.save();
    res.json({ message: "User Registered!" });
  } catch (err) {
    res.status(500).json({ message: "Error signing up" });
  }
});

// Login Route
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user._id }, "secret", { expiresIn: "1h" });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: "Error logging in" });
  }
});

// Fund Transfer Route
app.post("/transfer", async (req, res) => {
  try {
    const { senderEmail, receiverEmail, amount,category,description,date } = req.body;
    const sender = await User.findOne({ email: senderEmail });
    const receiver = await User.findOne({ email: receiverEmail });

    if (!sender || !receiver){
      return res.status(400).json({ message: "Receiver email isn't linked to an account" });
    }
	  if(sender.balance < amount) {
      return res.status(400).json({ message: "Transaction Failed - Low Balance" });
    }

    sender.balance -= amount;
    receiver.balance += amount;
    const transaction = new Transaction({ senderEmail: senderEmail, receiverEmail: receiverEmail, amount:amount,category:category,description:description,date:date });
    await transaction.save();

    sender.transactions.push(transaction._id);
    receiver.transactions.push(transaction._id);
    await sender.save();
    await receiver.save();

    res.json({ message: "Transfer Successful" });
  } catch (err) {
    res.status(500).json({ message: "Error processing transfer" });
  }
});

app.post("/api/transactions", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const transactions = await Transaction.find({ $or:[{senderEmail:email},{receiverEmail:email}]}).sort({ date: -1 });
    res.json({transactions});
  } catch (err) {
    res.status(500).json({ error: "Error fetching transactions" });
  }
});

app.post("/api/updateBalance", async (req, res) => {
  try {
    const { email,balance } = req.body;
    if (!email||!balance) return res.status(400).json({ error: "Email and balance are required" });

    const balanceUpdate = await User.updateOne({ email }, { balance: balance });
    if (balanceUpdate.nModified === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "Balance updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error fetching transactions" });
  }
});

// Fetch user's expenses (new GET route)
app.post("/api/expenses", async (req, res) => {
  try {
    const { userEmail } = req.body;
    if (!userEmail) return res.status(400).json({ message: "User email is required" });

    const expenses = await Expense.find({ userEmail }).sort({ date: -1 });
    res.json({expenses});
  } catch (error) {
    res.status(500).json({ message: "Error fetching expenses", error });
  }
});

// Save Expense Entry
app.post("/api/add-expense", async (req, res) => {
  try {
    const { userEmail, expenseType, recipient, amount, remarks, date } = req.body;

    if (!userEmail || !expenseType || !amount || !recipient) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newExpense = new Expense({ userEmail, expenseType, recipient, amount, remarks, date });
    await newExpense.save();

    res.status(201).json({ message: "Expense saved successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Error saving expense", error });
  }
});

app.use("/api/expense-types", expenseTypeRoutes);

// User Settings Routes
app.get("/user/settings", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.query.email });
    res.json({ profile: { name: user.name, email: user.email }, notifications: user.notifications });
  } catch (err) {
    res.status(500).json({ message: "Error fetching user settings" });
  }
});

app.put("/user/settings", async (req, res) => {
  try {
    await User.updateOne({ email: req.body.profile.email }, { name: req.body.profile.name, notifications: req.body.notifications });
    res.send("Settings updated");
  } catch (err) {
    res.status(500).json({ message: "Error updating settings" });
  }
});

app.put("/user/change-password", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await User.updateOne({ email: req.body.email }, { password: hashedPassword });
    res.send("Password updated");
  } catch (err) {
    res.status(500).json({ message: "Error changing password" });
  }
});

app.post("/user/enable-2fa", (req, res) => {
  res.send("2FA enabled (mocked)"); // Implement real 2FA logic
});

app.delete("/user/delete-account", async (req, res) => {
  try {
    await User.deleteOne({ email: req.body.email });
    res.send("Account deleted");
  } catch (err) {
    res.status(500).json({ message: "Error deleting account" });
  }
});

// Start server
app.listen(5000, () => console.log("Server running on port 5000"));
