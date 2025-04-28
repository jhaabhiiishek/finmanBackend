import mongoose from "mongoose"

const ExpenseTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
});

const ExpenseType= mongoose.model("ExpenseType", ExpenseTypeSchema);
export default ExpenseType
