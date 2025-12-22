
// seafood-backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// ✅ CLOUD PREP: Use the port Render assigns, or fallback to 5000 for local
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// --- 1. Database Connection ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seafoodApp';

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected!"))
  .catch((err) => console.log("❌ Connection Error:", err));

// --- 2. Define Schemas ---

// 🛵 Driver Schema
const DriverSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    vehicleNumber: String,
    isOnline: { type: Boolean, default: false },
    location: {
        latitude: Number,
        longitude: Number
    },
    status: { type: String, default: "Idle" }
});
const Driver = mongoose.model('Driver', DriverSchema);

// 💰 Withdrawal Schema
const WithdrawalSchema = new mongoose.Schema({
    driverId: String,
    amount: Number,
    upiId: String,
    status: { type: String, default: "Pending" }, // Pending, Paid
    transactionId: String,
    date: { type: Date, default: Date.now }
});
const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);

// 👤 User Schema
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mobile: { type: String, default: "" },
    profilePic: { type: String, default: "" },
    location: { 
        type: { type: String, default: "Point" }, 
        coordinates: { type: [Number], default: [0, 0] } 
    },
    addresses: [{
        label: String, 
        street: String,
        city: String,
        zip: String,
        country: String,
        phone: String
    }]
});
UserSchema.index({ location: "2dsphere" }); 
const User = mongoose.model('User', UserSchema);

// 🐟 Product Schema
const ProductSchema = new mongoose.Schema({
    name: String,
    description: String,
    price: Number,
    category: String,
    imageUrl: String,
    deliveryTime: { type: String, default: "30-45 min" },
    rating: { type: Number, default: 4.5 },
    isBestseller: Boolean
});
const Product = mongoose.model('Product', ProductSchema);

// 📦 Order Schema
const OrderSchema = new mongoose.Schema({
    userId: String,
    userEmail: String,
    items: Array, 
    totalAmount: Number,
    address: Object, 
    paymentMethod: String, 
    status: { type: String, default: "Placed" }, 
    date: { type: Date, default: Date.now },
    driverId: { type: String, default: null }, 
    driverName: { type: String, default: null },
    driverLocation: { 
        latitude: Number,
        longitude: Number
    }
});
const Order = mongoose.model('Order', OrderSchema);

// --- 3. API Routes ---

// --- 👤 USER ROUTES ---
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, password });
    if (user) res.json({ success: true, user: user });
    else res.status(401).json({ success: false, message: "Invalid credentials" });
  } catch (error) { res.status(500).json({ success: false, message: "Server Error" }); }
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: "Email already registered" });
    const newUser = new User({ name, email, password, location: { type: "Point", coordinates: [0, 0] } });
    await newUser.save();
    res.json({ success: true, message: "Registration successful!" });
  } catch (error) { res.status(500).json({ success: false, message: "Server Error" }); }
});

app.put('/update-profile', async (req, res) => {
  const { email, name, mobile, password, profilePic } = req.body;
  try {
    let updateFields = {};
    if (name) updateFields.name = name;
    if (mobile) updateFields.mobile = mobile;
    if (password) updateFields.password = password;
    if (profilePic !== undefined) updateFields.profilePic = profilePic;

    const updatedUser = await User.findOneAndUpdate({ email }, { $set: updateFields }, { new: true });
    if (updatedUser) res.json({ success: true, user: updatedUser });
    else res.status(404).json({ success: false, message: "User not found" });
  } catch (error) { res.status(500).json({ success: false, message: "Server Error" }); }
});

app.post('/add-address/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { label, street, city, zip, country, phone } = req.body;
    if (!street || !city || !zip || !phone) return res.status(400).json({ success: false, message: "Missing fields" });

    const newAddress = { label, street, city, zip, country, phone };
    const updatedUser = await User.findOneAndUpdate({ email: email }, { $push: { addresses: newAddress } }, { new: true });
    if (!updatedUser) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, message: "Address added", user: updatedUser });
  } catch (error) { res.status(500).json({ success: false, message: "Server error" }); }
});

app.put('/update-address/:email', async (req, res) => {
    const { email } = req.params;
    const { _id, label, street, city, zip, country, phone } = req.body;
    try {
        await User.findOneAndUpdate(
            { email: email, "addresses._id": _id },
            { $set: { "addresses.$.label": label, "addresses.$.street": street, "addresses.$.city": city, "addresses.$.zip": zip, "addresses.$.country": country, "addresses.$.phone": phone } }
        );
        res.json({ success: true, message: "Address updated" });
    } catch (error) { res.status(500).json({ success: false, message: "Error updating address" }); }
});

app.delete('/delete-address/:email/:addressId', async (req, res) => {
  try {
    const { email, addressId } = req.params;
    await User.findOneAndUpdate({ email: email }, { $pull: { addresses: { _id: addressId } } });
    res.json({ success: true, message: "Address deleted" });
  } catch (error) { res.status(500).json({ success: false, message: "Error deleting address" }); }
});

app.get('/user/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, user: user });
  } catch (error) { res.status(500).json({ success: false, message: "Error fetching user" }); }
});

// --- 🛒 ORDER ROUTES ---
app.post('/create-order', async (req, res) => {
    const { userEmail, items, totalAmount, address, paymentMethod } = req.body;
    try {
        const newOrder = new Order({ userEmail, items, totalAmount, address, paymentMethod, status: "Placed" });
        const savedOrder = await newOrder.save();
        res.json({ success: true, orderId: savedOrder._id, order: savedOrder });
    } catch (error) { res.status(500).json({ success: false, message: "Could not place order" }); }
});

app.get('/track-order/:orderId', async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (order) res.json({ success: true, order });
        else res.status(404).json({ success: false, message: "Order not found" });
    } catch (error) { res.status(500).json({ success: false, message: "Server Error" }); }
});

app.get('/my-orders/:email', async (req, res) => {
  try {
    const orders = await Order.find({ userEmail: req.params.email }).sort({ date: -1 });
    res.json({ success: true, orders });
  } catch (error) { res.status(500).json({ success: false, message: "Error fetching orders" }); }
});

// --- 🐟 PRODUCT ROUTES ---
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) { res.status(500).json({ message: "Error fetching products" }); }
});

app.post('/admin/add-product', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.json({ success: true, message: "Product added!" });
    } catch (error) { res.status(500).json({ success: false, message: "Error adding product" }); }
});

app.get('/seed-products', async (req, res) => {
    // Basic seed if needed
    res.send("Seed logic here");
});

// --- 🛵 DRIVER ROUTES ---
app.post('/driver/register', async (req, res) => {
    const { name, email, password, phone, vehicleNumber } = req.body;
    try {
        const newDriver = new Driver({ name, email, password, phone, vehicleNumber });
        await newDriver.save();
        res.json({ success: true, message: "Driver Registered" });
    } catch (error) { res.status(500).json({ success: false, message: "Error registering driver" }); }
});

app.post('/driver/login', async (req, res) => {
    const { email, password } = req.body;
    const driver = await Driver.findOne({ email, password });
    if (driver) res.json({ success: true, driver });
    else res.json({ success: false, message: "Invalid credentials" });
});

app.post('/driver/status', async (req, res) => {
    const { driverId, isOnline, location } = req.body;
    try {
        await Driver.findByIdAndUpdate(driverId, { isOnline, location: location || { latitude: 0, longitude: 0 } });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, message: "Error updating status" }); }
});

// Get Available Orders (Includes Assigned & In-Progress)
app.get('/driver/orders', async (req, res) => {
    try {
        const { currentDriverId } = req.query;
        const orders = await Order.find({
            $or: [
                { status: 'Placed', driverId: { $exists: false } }, // New orders
                { driverId: currentDriverId, status: { $in: ['Preparing', 'Out for Delivery'] } } // My orders
            ]
        }).sort({ date: -1 });
        res.json({ success: true, orders });
    } catch (error) { res.status(500).json({ success: false, message: "Error fetching orders" }); }
});

app.post('/driver/accept', async (req, res) => {
    const { orderId, driverId, driverName } = req.body;
    await Order.findByIdAndUpdate(orderId, { driverId, driverName, status: 'Preparing' });
    res.json({ success: true, message: "Order Accepted" });
});

app.post('/driver/update-order-status', async (req, res) => {
    const { orderId, status } = req.body;
    await Order.findByIdAndUpdate(orderId, { status });
    res.json({ success: true, message: "Status Updated" });
});

app.post('/driver/withdraw', async (req, res) => {
    const { driverId, amount, upiId } = req.body;
    try {
        const newWithdrawal = new Withdrawal({ driverId, amount, upiId, status: "Paid", transactionId: "TXN_" + Date.now() });
        await newWithdrawal.save();
        res.json({ success: true, message: "Withdrawal Successful" });
    } catch (error) { res.status(500).json({ success: false }); }
});

// ===========================================
// 👑 ADMIN PORTAL ROUTES (Consolidated)
// ===========================================

// 1. Get ALL Orders
app.get('/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ date: -1 });
        res.json(orders);
    } catch (error) { res.status(500).json({ message: "Server Error" }); }
});

// 2. Get ALL Drivers
app.get('/admin/drivers', async (req, res) => {
    try {
        const drivers = await Driver.find(); // Using correct 'Driver' model
        res.json(drivers);
    } catch (error) { res.status(500).json({ message: "Error fetching drivers" }); }
});

// 3. Get Withdrawal Requests
app.get('/admin/withdrawals', async (req, res) => {
    try {
        const requests = await Withdrawal.find().sort({ date: -1 });
        res.json(requests);
    } catch (error) { res.status(500).json({ message: "Error" }); }
});

// 4. Update Order Status (Admin override)
app.post('/admin/order-status', async (req, res) => {
    const { orderId, status } = req.body;
    await Order.findByIdAndUpdate(orderId, { status });
    res.json({ success: true });
});

// 5. Assign Driver Manually
app.post('/admin/assign-driver', async (req, res) => {
    const { orderId, driverId, driverName } = req.body;
    try {
        await Order.findByIdAndUpdate(orderId, { driverId, driverName, status: 'Preparing' });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, message: "Error assigning driver" }); }
});

// Server Listen
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
