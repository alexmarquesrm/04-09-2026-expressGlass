const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const tasksRoutes = require('./routes/tasks.routes');
const chatRoutes = require('./routes/chat.routes');
const boardsRoutes = require('./routes/boards.routes');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const errorHandler = require('./middleware/errorHandler');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET environment variable is missing');
  process.exit(1);
}

const app = express();

const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/tasks', tasksRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/boards', boardsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

app.use(errorHandler);

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Backend listening on :${port}`));

module.exports = app;
