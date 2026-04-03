const { connectToWhatsApp } = require('./src/services/whatsapp.service');
const { startServer } = require('./src/server');
require('dotenv').config();

async function startBot() {
    try {
        console.log('Starting IOSB Bot & Admin Dashboard...');
        startServer();
        await connectToWhatsApp();
    } catch (error) {
        console.error('Failed to start bot:', error);
    }
}

startBot();
