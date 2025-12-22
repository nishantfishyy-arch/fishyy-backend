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
// ✅ CLOUD PREP: Use the Cloud Secret (MONGO_URI) if available, otherwise use Localhost
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
    status: { type: String, default: "Idle" } // Idle, Busy
});
const Driver = mongoose.model('Driver', DriverSchema);

// 💰 Withdrawal Schema (For Wallet & Payouts)
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

    // Driver Fields
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
    if (user) {
      res.json({ success: true, user: user });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    const newUser = new User({ 
        name, 
        email, 
        password,
        location: { type: "Point", coordinates: [0, 0] }
    });
    await newUser.save();
    res.json({ success: true, message: "Registration successful!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.put('/update-profile', async (req, res) => {
  const { email, name, mobile, password, profilePic } = req.body;
  try {
    let updateFields = {};
    if (name) updateFields.name = name;
    if (mobile) updateFields.mobile = mobile;
    if (password) updateFields.password = password;
    if (profilePic !== undefined) updateFields.profilePic = profilePic;

    const updatedUser = await User.findOneAndUpdate(
      { email }, 
      { $set: updateFields }, 
      { new: true } 
    );
    if (updatedUser) res.json({ success: true, user: updatedUser });
    else res.status(404).json({ success: false, message: "User not found" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.post('/add-address/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { label, street, city, zip, country, phone } = req.body;

    if (!street || !city || !zip || !phone) return res.status(400).json({ success: false, message: "Missing fields" });

    const newAddress = { label, street, city, zip, country, phone };
    const updatedUser = await User.findOneAndUpdate(
      { email: email },
      { $push: { addresses: newAddress } },
      { new: true }
    );
    if (!updatedUser) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, message: "Address added", user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put('/update-address/:email', async (req, res) => {
    const { email } = req.params;
    const { _id, label, street, city, zip, country, phone } = req.body;
    try {
        await User.findOneAndUpdate(
            { email: email, "addresses._id": _id },
            { 
                $set: {
                    "addresses.$.label": label,
                    "addresses.$.street": street,
                    "addresses.$.city": city,
                    "addresses.$.zip": zip,
                    "addresses.$.country": country,
                    "addresses.$.phone": phone
                }
            }
        );
        res.json({ success: true, message: "Address updated" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error updating address" });
    }
});

app.delete('/delete-address/:email/:addressId', async (req, res) => {
  try {
    const { email, addressId } = req.params;
    await User.findOneAndUpdate(
      { email: email },
      { $pull: { addresses: { _id: addressId } } } 
    );
    res.json({ success: true, message: "Address deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting address" });
  }
});

app.get('/user/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, user: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching user" });
  }
});

app.get('/search-nearby', async (req, res) => {
    const { lat, long } = req.query;
    try {
        const nearby = await User.find({
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [parseFloat(long), parseFloat(lat)] },
                    $maxDistance: 5000 
                }
            }
        });
        res.json(nearby);
    } catch (e) { res.status(500).json({error: e.message}); }
});

// ⚠️ RESTORED LEGACY ROUTE (Add this if your App crashes on Address Save)
app.put('/save-address', async (req, res) => {
  const { email, address } = req.body; 
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const existingIndex = user.addresses.findIndex(addr => addr.label === address.label);
    if (existingIndex > -1) {
        user.addresses[existingIndex] = address; // Update
    } else {
        user.addresses.push(address); // Add
    }

    await user.save();
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// --- 🛒 ORDER ROUTES ---

app.post('/create-order', async (req, res) => {
    const { userEmail, items, totalAmount, address, paymentMethod } = req.body;
    try {
        const newOrder = new Order({
            userEmail, items, totalAmount, address, paymentMethod, status: "Placed"
        });
        const savedOrder = await newOrder.save();
        res.json({ success: true, orderId: savedOrder._id, order: savedOrder });
    } catch (error) {
        res.status(500).json({ success: false, message: "Could not place order" });
    }
});

app.get('/track-order/:orderId', async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (order) res.json({ success: true, order });
        else res.status(404).json({ success: false, message: "Order not found" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

app.get('/my-orders/:email', async (req, res) => {
  try {
    const orders = await Order.find({ userEmail: req.params.email }).sort({ date: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching orders" });
  }
});

// --- 🐟 PRODUCT ROUTES ---

app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Error fetching products" });
  }
});

app.post('/admin/add-product', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.json({ success: true, message: "Product added!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error adding product" });
    }
});

app.put('/admin/product/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, product: updatedProduct });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error updating product" });
    }
});

app.delete('/admin/product/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Product deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error deleting product" });
    }
});

app.get('/seed-products', async (req, res) => {
    const initialData = [
        { name: "Atlantic Salmon", category: "Fish", price: 850, description: "Fresh premium cut.", imageUrl: "https://cdn-icons-png.flaticon.com/512/2921/2921822.png", deliveryTime: "35 min" },
        { name: "Jumbo Prawns", category: "Prawns", price: 600, description: "Perfect for grilling.", imageUrl: "https://cdn-icons-png.flaticon.com/512/1691/1691147.png", deliveryTime: "30 min" },
        { name: "Live Mud Crab", category: "Crabs", price: 1200, description: "Meaty and sweet.", imageUrl: "https://cdn-icons-png.flaticon.com/512/3063/3063816.png", deliveryTime: "45 min" },
        { name: "Fresh Squid", category: "Squid", price: 450, description: "Cleaned.", imageUrl: "https://cdn-icons-png.flaticon.com/512/3063/3063822.png", deliveryTime: "40 min" }
    ];
    await Product.insertMany(initialData);
    res.send("Database populated with fresh seafood in Rupees! 🐟 ₹");
});

app.get('/clear-products', async (req, res) => {
    try {
        await Product.deleteMany({});
        res.send("All products deleted!");
    } catch (error) {
        res.status(500).send("Error clearing products");
    }
});

// --- 🛵 DRIVER ROUTES ---

app.post('/driver/register', async (req, res) => {
    const { name, email, password, phone, vehicleNumber } = req.body;
    try {
        const newDriver = new Driver({ name, email, password, phone, vehicleNumber });
        await newDriver.save();
        res.json({ success: true, message: "Driver Registered" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error registering driver" });
    }
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
        await Driver.findByIdAndUpdate(driverId, { 
            isOnline, 
            location: location || { latitude: 0, longitude: 0 } 
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error updating status" });
    }
});

// ✅ Get Available Orders (Includes Assigned & In-Progress)
app.get('/driver/orders', async (req, res) => {
    try {
        const { currentDriverId } = req.query;

        const orders = await Order.find({
            $or: [
                // 1. Unassigned new orders (Available for anyone)
                { status: 'Placed', driverId: { $exists: false } },
                
                // 2. Orders assigned to THIS driver (Preparing OR Out for Delivery)
                { driverId: currentDriverId, status: { $in: ['Preparing', 'Out for Delivery'] } } 
            ]
        }).sort({ date: -1 });

        res.json({ success: true, orders });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching orders" });
    }
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

// ✅ Get Driver Earnings (7% Commission)
app.get('/driver/stats/:driverId', async (req, res) => {
    try {
        const { driverId } = req.params;
        const orders = await Order.find({ driverId, status: 'Delivered' });
        
        let totalRevenue = 0;
        orders.forEach(o => {
            totalRevenue += o.totalAmount || 0;
        });
        
        // 7% Commission
        const earnings = totalRevenue * 0.07; 

        res.json({ 
            success: true, 
            stats: {
                completedOrders: orders.length,
                totalRevenue,
                earnings
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching stats" });
    }
});

// ✅ Automatic Withdrawal Route (Simulation) with 7% Logic
app.post('/driver/withdraw', async (req, res) => {
    const { driverId, amount, upiId } = req.body;

    try {
        // 1. Calculate Driver's Real Balance using 7% logic
        const orders = await Order.find({ driverId: driverId, status: 'Delivered' });
        const totalEarnings = orders.reduce((sum, order) => sum + (order.totalAmount * 0.07), 0);

        const withdrawals = await Withdrawal.find({ driverId: driverId, status: 'Paid' });
        const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);

        // Allow a small buffer for rounding errors (e.g. 0.01)
        const currentBalance = totalEarnings - totalWithdrawn;

        // 2. Validate Balance
        if (currentBalance < amount) {
            return res.json({ success: false, message: `Insufficient Balance. Available: ₹${currentBalance.toFixed(2)}` });
        }

        // 3. Create Withdrawal Record (Paid)
        const newWithdrawal = new Withdrawal({
            driverId,
            amount,
            upiId,
            status: "Paid", 
            transactionId: "TXN_" + Date.now(),
            date: new Date()
        });

        await newWithdrawal.save();

        res.json({ 
            success: true, 
            message: `₹${amount.toFixed(2)} sent to ${upiId} successfully!`,
            newBalance: currentBalance - amount
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// --- 👑 ADMIN ROUTES ---

app.get('/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ date: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

app.post('/admin/order-status', async (req, res) => {
    const { orderId, status } = req.body;
    await Order.findByIdAndUpdate(orderId, { status });
    res.json({ success: true });
});

app.get('/admin/drivers', async (req, res) => {
    try {
        const drivers = await Driver.find();
        res.json(drivers);
    } catch (error) {
        res.status(500).json({ message: "Error fetching drivers" });
    }
});

app.post('/admin/assign-driver', async (req, res) => {
    const { orderId, driverId, driverName } = req.body;
    try {
        await Order.findByIdAndUpdate(orderId, { driverId, driverName, status: 'Preparing' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error assigning driver" });
    }
});

app.get('/order/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (order) res.json({ success: true, order });
        else res.json({ success: false, message: "Order not found" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

app.get('/admin/withdrawals', async (req, res) => {
    try {
        const requests = await Withdrawal.find().sort({ date: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: "Error" });
    }
});

// ===========================================
// 👑 ADMIN PORTAL ROUTES (Add these to server.js)
// ===========================================

// 1. Get ALL Orders (for Admin Dashboard)
app.get('/admin/orders', async (req, res) => {
    try {
        // Fetch all orders, sorted by newest first
        const orders = await Order.find().sort({ date: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching orders" });
    }
});

// 2. Get ALL Drivers (for Fleet Management)
app.get('/admin/drivers', async (req, res) => {
    try {
        // Assuming your driver collection is named 'User' and drivers have role='driver'
        // If you have a separate 'Driver' model, change 'User' to 'Driver'
        const drivers = await User.find({ role: 'driver' }); 
        res.json(drivers);
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching drivers" });
    }
});

// 3. Get Withdrawal Requests (for Payouts)
app.get('/admin/withdrawals', async (req, res) => {
    try {
        // If you don't have a Withdrawal model yet, return empty array to prevent 404
        // const withdrawals = await Withdrawal.find().sort({ date: -1 });
        res.json([]); // Returning empty array for now so app doesn't crash
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching withdrawals" });
    }
});

// 4. Update Order Status (Accept, Cook, Deliver)
app.post('/admin/order-status', async (req, res) => {
    const { orderId, status } = req.body;
    try {
        await Order.findByIdAndUpdate(orderId, { status: status });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// 5. Assign Driver to Order
app.post('/admin/assign-driver', async (req, res) => {
    const { orderId, driverId, driverName } = req.body;
    try {
        await Order.findByIdAndUpdate(orderId, { 
            driverId: driverId,
            driverName: driverName,
            status: 'Out for Delivery' // Auto-update status when assigned
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
