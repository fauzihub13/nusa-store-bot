require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const prisma = require('./lib/prisma');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'nusastore_secret_2025',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Make prisma available to routes
app.locals.prisma = prisma;

// Routes
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/api'));

// Home redirect to admin
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Start server
const PORT = process.env.PORT || 3000;

async function main() {
  try {
    await prisma.$connect();
    console.log('Database connected');

    // Start bot only if token is provided
    if (process.env.BOT_TOKEN && process.env.BOT_TOKEN !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      const { bot } = require('./bot');
      bot.start({
        onStart: () => console.log('Bot started'),
      });
    } else {
      console.log('Bot not started (no valid BOT_TOKEN)');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Admin panel: http://localhost:${PORT}/admin`);
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
