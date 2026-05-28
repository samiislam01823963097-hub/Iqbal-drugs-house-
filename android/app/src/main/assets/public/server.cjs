var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_url = require("url");
var import_fs = __toESM(require("fs"), 1);
var import_promises = __toESM(require("fs/promises"), 1);
var import_meta = {};
var __dirname = import_path.default.dirname((0, import_url.fileURLToPath)(import_meta.url));
var DB_FILE = import_path.default.resolve(process.cwd(), "data", "pharmacy_db.json");
async function readDb() {
  try {
    if (!import_fs.default.existsSync(DB_FILE)) {
      return { medicines: [], bills: [], returns: [], orders: [] };
    }
    const data = await import_promises.default.readFile(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading db file, returning empty structure", error);
    return { medicines: [], bills: [], returns: [], orders: [] };
  }
}
async function writeDb(db) {
  try {
    const parentDir = import_path.default.dirname(DB_FILE);
    if (!import_fs.default.existsSync(parentDir)) {
      await import_promises.default.mkdir(parentDir, { recursive: true });
    }
    await import_promises.default.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Error writing db file", error);
    return false;
  }
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  const initialDb = await readDb();
  if (initialDb.medicines.length === 0) {
    const defaultData = {
      medicines: [
        { id: 101, name: "Paracetamol 500mg (Napa)", company: "Beximco Pharmaceuticals", salt: "Paracetamol", purchasePrice: 22, sellingPrice: 30, stock: 145, expiry: "2027-12-15", shelf: "Rack A-1" },
        { id: 102, name: "Azithromycin 250mg", company: "Square Pharmaceuticals", salt: "Azithromycin", purchasePrice: 55, sellingPrice: 72, stock: 75, expiry: "2026-12-20", shelf: "Rack B-3" },
        { id: 103, name: "Amoxicillin 500mg (Moxacil)", company: "Renata Limited", salt: "Amoxicillin", purchasePrice: 38, sellingPrice: 50, stock: 8, expiry: "2027-09-10", shelf: "Rack A-2" },
        { id: 104, name: "Cetirizine 10mg (Atova)", company: "Incepta Pharmaceuticals", salt: "Cetirizine", purchasePrice: 15, sellingPrice: 25, stock: 190, expiry: "2027-03-01", shelf: "Rack C-1" },
        { id: 105, name: "Omeprazole 20mg (Seclo)", company: "Square Pharmaceuticals", salt: "Omeprazole", purchasePrice: 42, sellingPrice: 58, stock: 3, expiry: "2026-08-30", shelf: "Rack D-2" },
        { id: 106, name: "Metformin 500mg", company: "ACI Limited", salt: "Metformin", purchasePrice: 28, sellingPrice: 40, stock: 55, expiry: "2027-07-15", shelf: "Rack E-4" },
        { id: 107, name: "Ibuprofen 400mg", company: "Opsonin Pharma", salt: "Ibuprofen", purchasePrice: 22, sellingPrice: 35, stock: 0, expiry: "2026-05-01", shelf: "Rack F-1" },
        { id: 108, name: "Dolo 650mg", company: "Micro Labs", salt: "Paracetamol", purchasePrice: 24, sellingPrice: 33, stock: 6, expiry: "2027-02-28", shelf: "Rack A-1" }
      ],
      bills: [],
      returns: [],
      orders: []
    };
    await writeDb(defaultData);
  }
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: /* @__PURE__ */ new Date() });
  });
  app.post("/api/auth/login", (req, res) => {
    const { username, password, role } = req.body;
    const auth = {
      admin: { pass: "admin123", role: "admin" },
      cashier: { pass: "cash123", role: "cashier" },
      stock_manager: { pass: "stock123", role: "stock_manager" }
    };
    const user = auth[username.toLowerCase()];
    if (user && user.pass === password && user.role === role) {
      res.json({
        success: true,
        username,
        role,
        token: `mock-jwt-token-for-${username}`
      });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials or mismatched role" });
    }
  });
  app.get("/api/medicines", async (req, res) => {
    const db = await readDb();
    res.json(db.medicines);
  });
  app.post("/api/medicines", async (req, res) => {
    const db = await readDb();
    const { name, company, salt, purchasePrice, sellingPrice, stock, expiry, shelf } = req.body;
    if (!name || !company || isNaN(sellingPrice)) {
      return res.status(400).json({ error: "Medicine name, company, and selling price are required" });
    }
    const newMed = {
      id: Date.now() % 1e5 + 200,
      name,
      company,
      salt: salt || "Generic",
      purchasePrice: Number(purchasePrice) || sellingPrice * 0.7,
      sellingPrice: Number(sellingPrice),
      stock: Number(stock) || 0,
      expiry: expiry || "",
      shelf: shelf || "Rack A-1"
    };
    db.medicines.push(newMed);
    await writeDb(db);
    res.status(201).json(newMed);
  });
  app.put("/api/medicines/:id", async (req, res) => {
    const db = await readDb();
    const id = parseInt(req.params.id);
    const index = db.medicines.findIndex((m) => m.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Medicine not found" });
    }
    const current = db.medicines[index];
    const updated = {
      ...current,
      ...req.body,
      // Keep safety formats
      purchasePrice: isNaN(req.body.purchasePrice) ? current.purchasePrice : Number(req.body.purchasePrice),
      sellingPrice: isNaN(req.body.sellingPrice) ? current.sellingPrice : Number(req.body.sellingPrice),
      stock: isNaN(req.body.stock) ? current.stock : Number(req.body.stock)
    };
    db.medicines[index] = updated;
    await writeDb(db);
    res.json(updated);
  });
  app.delete("/api/medicines/:id", async (req, res) => {
    const db = await readDb();
    const id = parseInt(req.params.id);
    const exists = db.medicines.some((m) => m.id === id);
    if (!exists) {
      return res.status(404).json({ error: "Medicine not found" });
    }
    db.medicines = db.medicines.filter((m) => m.id !== id);
    await writeDb(db);
    res.json({ success: true, message: "Medicine removed successfully" });
  });
  app.get("/api/bills", async (req, res) => {
    const db = await readDb();
    res.json(db.bills);
  });
  app.post("/api/bills", async (req, res) => {
    const db = await readDb();
    const { customer, items, discountPercent, discountVal, subtotal, grandTotal, cashierName } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }
    for (const item of items) {
      const realMed = db.medicines.find((m) => m.id === item.id);
      if (!realMed) {
        return res.status(400).json({ error: `Medicine '${item.name}' does not exist in inventory` });
      }
      if (realMed.stock < item.qty) {
        return res.status(400).json({ error: `Not enough stock for '${realMed.name}'. Available: ${realMed.stock}, requested: ${item.qty}` });
      }
      if (realMed.expiry && new Date(realMed.expiry) < /* @__PURE__ */ new Date()) {
        return res.status(400).json({ error: `Medicine '${realMed.name}' has already expired and cannot be sold` });
      }
    }
    for (const item of items) {
      const realMedVal = db.medicines.find((m) => m.id === item.id);
      realMedVal.stock -= item.qty;
    }
    const nextBillNo = `MC-${db.bills.length + 2101}`;
    const newBill = {
      billNo: nextBillNo,
      date: (/* @__PURE__ */ new Date()).toLocaleDateString(),
      customer: customer || "Guest Customer",
      items,
      subtotal: Number(subtotal),
      discountPercent: Number(discountPercent) || 0,
      discountVal: Number(discountVal) || 0,
      grandTotal: Number(grandTotal),
      cashierName: cashierName || "Unknown Cashier"
    };
    db.bills.unshift(newBill);
    await writeDb(db);
    res.status(201).json(newBill);
  });
  app.post("/api/returns", async (req, res) => {
    const db = await readDb();
    const { billNo, medId, qty } = req.body;
    if (!billNo || !medId || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: "Valid billNo, medId, and quantity to return are required" });
    }
    const medicine = db.medicines.find((m) => m.id === Number(medId));
    if (!medicine) {
      return res.status(404).json({ error: "Medicine not found in our database" });
    }
    medicine.stock += Number(qty);
    const log = {
      id: `RET-${Date.now()}`,
      date: (/* @__PURE__ */ new Date()).toLocaleDateString(),
      billNo,
      medId: Number(medId),
      medName: medicine.name,
      qty: Number(qty)
    };
    db.returns.unshift(log);
    await writeDb(db);
    res.status(201).json({ success: true, log, updatedMedicine: medicine });
  });
  app.get("/api/returns", async (req, res) => {
    const db = await readDb();
    res.json(db.returns);
  });
  app.get("/api/orders", async (req, res) => {
    const db = await readDb();
    res.json(db.orders);
  });
  app.post("/api/orders", async (req, res) => {
    const db = await readDb();
    const { medId, qty, supplier, expectedDate } = req.body;
    if (!medId || !qty || isNaN(qty) || qty <= 0 || !supplier) {
      return res.status(400).json({ error: "medId, quantity, and supplier are required" });
    }
    const med = db.medicines.find((m) => m.id === Number(medId));
    if (!med) {
      return res.status(404).json({ error: "Requested medicine for purchase order is not found" });
    }
    const orderId = `PO-${Date.now()}`;
    const newOrder = {
      id: orderId,
      medId: Number(medId),
      medName: med.name,
      qty: Number(qty),
      supplier,
      expectedDate: expectedDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      status: "Pending",
      createdAt: (/* @__PURE__ */ new Date()).toLocaleDateString()
    };
    db.orders.unshift(newOrder);
    await writeDb(db);
    res.status(201).json(newOrder);
  });
  app.put("/api/orders/:id", async (req, res) => {
    const db = await readDb();
    const orderId = req.params.id;
    const orderIndex = db.orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    const { status } = req.body;
    if (status !== "Received" && status !== "Cancelled") {
      return res.status(400).json({ error: "Invalid status update. Only 'Received' or 'Cancelled' is allowed." });
    }
    const order = db.orders[orderIndex];
    if (order.status !== "Pending") {
      return res.status(400).json({ error: `Order is already marked as ${order.status}` });
    }
    order.status = status;
    if (status === "Received") {
      order.receivedDate = (/* @__PURE__ */ new Date()).toLocaleDateString();
      const med = db.medicines.find((m) => m.id === order.medId);
      if (med) {
        med.stock += order.qty;
      }
    }
    db.orders[orderIndex] = order;
    await writeDb(db);
    res.json({ success: true, order });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
