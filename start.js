"use strict";

/**
 * Project: DarkX Ultra
 * Entry Point — boots the web pairing dashboard + socket.io,
 * then resumes every previously-paired session.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const chalkImport = require('chalk');
const chalk = chalkImport.default || chalkImport;

const cors = require('cors');
const config = require('./settings/config');
const { resumeExistingSessions, startWatchdog } = require('./index');
const registerSocketHandlers = require('./Resources/socket/socket');
const apiRoutes = require('./Resources/web/routes');
const adminRoutes = require('./Resources/web/adminRoutes');
const bugRoutes = require('./Resources/web/bugRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Resources', 'web')));
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bugs', bugRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Resources', 'web', 'index.html'));
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', bot: config.botName, uptime: process.uptime() });
});

registerSocketHandlers(io);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(chalk.magentaBright(`\n👑 ${config.botName} is LIVE`));
    console.log(chalk.cyan(`🌐 Web pairing running on port ${PORT}`));
    console.log(chalk.green('💖 Open the web page to pair your WhatsApp number\n'));

    setTimeout(() => {
        resumeExistingSessions(io);
        startWatchdog(io);
    }, 2000);

    // Some free-tier hosts put the whole process to sleep after a period of
    // no inbound HTTP traffic, which would also kill every WhatsApp session.
    // A small self-ping every few minutes keeps the process (and therefore
    // every linked session) alive. Harmless on hosts that don't sleep.
    setInterval(() => {
        http.get(`http://127.0.0.1:${PORT}/health`, (res) => res.resume()).on('error', () => {});
    }, 4 * 60_000);
});

process.on('uncaughtException', (err) => {
    console.error(chalk.red('CRITICAL ERROR (Uncaught Exception):'), err);
});

process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('CRITICAL ERROR (Unhandled Rejection):'), reason);
});
