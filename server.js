require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const apiRoutes = require('./routes/api');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api', apiRoutes);
app.get("/",(req,res)=>{
  res.send("server is running successfully")
})
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => {
    console.log('MongoDB Atlas Connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('Database connection error:', err));
