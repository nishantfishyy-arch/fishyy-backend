// seafood-backend/seed.js
const mongoose = require('mongoose');

// ✅ This works perfectly
mongoose.connect('mongodb://127.0.0.1:27017/seafoodApp')
  .then(() => console.log("Seeding database..."))
  .catch(err => console.log(err));

const Product = mongoose.model('Product', new mongoose.Schema({
    name: String, description: String, price: Number, category: String, 
    imageUrl: String, deliveryTime: String, isBestseller: Boolean
}));

const data = [
    { name: "Atlantic Salmon", description: "Fresh premium cut.", price: 500, category: "Fish", imageUrl: "https://images.unsplash.com/photo-1599084993091-1a820b293b5c?w=500", deliveryTime: "35 min", isBestseller: true },
    { name: "Jumbo Prawns", description: "Perfect for grilling.", price: 399, category: "Shellfish", imageUrl: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500", deliveryTime: "30 min", isBestseller: true },
    { name: "Jumbo Prawns (1pc)", description: "Perfect for grilling.", price: 10, category: "Prawns",  imageUrl: "https://cdn-icons-png.flaticon.com/512/1691/1691147.png", deliveryTime: "30 min",  isBestseller: true },
    { name: "Live Mud Crab", description: "Meaty and sweet.", price: 750, category: "Crab", imageUrl: "https://images.unsplash.com/photo-1551248429-40975aa4de74?w=500", deliveryTime: "45 min", isBestseller: false }
];

const seed = async () => {
    await Product.deleteMany({});
    await Product.insertMany(data);
    console.log("Data Seeded!");
    mongoose.connection.close();
};
seed();