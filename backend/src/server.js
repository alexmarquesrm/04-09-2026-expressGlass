const express = require('express');
const cors = require('cors');
const tasksRoutes = require('./routes/tasks.routes');
const chatRoutes = require('./routes/chat.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/tasks', tasksRoutes);
app.use('/api/chat', chatRoutes);

app.use(errorHandler);

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Backend listening on :${port}`));

module.exports = app;
