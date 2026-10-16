const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');

dotenv.config();
connectDB();

const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || 'https://your-frontend-domain.vercel.app'
    : 'http://localhost:5173',
  credentials: true,
  exposedHeaders: ['Content-Disposition']
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/interview', require('./src/routes/interviewRoutes'));
app.use('/api/history', require('./src/routes/historyRoutes'));
app.use('/api/dashboard', require('./src/routes/dashboardRoutes'));
app.use('/api/resume', require('./src/routes/resumeRoutes'));

app.get('/', (req, res) => {
  res.send('AI Interview Coach API is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
