const express = require('express');
const router = express.Router();
const supabase = require('../database/supabase');
const userService = require('../services/user.service');
const { getBotStatus, triggerPairingCode } = require('../services/whatsapp.service');
const fivesim = require('./fivesim');
const smsactivate = require('./smsactivate');

// Middleware to check ADMIN_SECRET
const authenticateAdmin = (req, res, next) => {
    const secret = req.headers['x-admin-secret'];
    if (!secret || secret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

router.use(authenticateAdmin);

// --- DASHBOARD STATS ---
router.get('/stats', async (req, res) => {
    try {
        const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: ordersCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
        const { data: revenueData } = await supabase.from('transactions').select('amount').eq('type', 'purchase');
        
        const totalRevenue = revenueData ? revenueData.reduce((acc, curr) => acc + curr.amount, 0) : 0;
        
        res.json({
            users: usersCount || 0,
            orders: ordersCount || 0,
            revenue: totalRevenue
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- USERS MANAGEMENT ---
router.get('/users', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('*').order('registered_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/users/fund', async (req, res) => {
    const { phone, amount } = req.body;
    if (!phone || !amount) {
        return res.status(400).json({ error: 'Phone and amount required' });
    }
    try {
        const jid = `${phone}@s.whatsapp.net`;
        const newBalance = await userService.updateBalance(jid, parseInt(amount), 'deposit', `ADMIN-FUND-${Date.now()}`);
        res.json({ success: true, newBalance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- RATES MANAGEMENT ---
router.get('/rates', async (req, res) => {
    try {
        const { data, error } = await supabase.from('rates').select('*').order('country_code');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/rates', async (req, res) => {
    const { country_code, service_code, price, display_name } = req.body;
    try {
        const { data, error } = await supabase
            .from('rates')
            .upsert({ country_code, service_code, price, display_name }, { onConflict: 'country_code,service_code' })
            .select();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/rates', async (req, res) => {
    const { country_code, service_code } = req.body;
    try {
        const { error } = await supabase.from('rates').delete().match({ country_code, service_code });
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- UPSTREAM APIS ---
router.get('/upstream/balance', async (req, res) => {
    try {
        let fsBalance = null;
        let saBalance = null;

        try { fsBalance = await fivesim.getBalance(); } catch(e) { fsBalance = 'Error'; }
        try { saBalance = await smsactivate.getBalance(); } catch(e) { saBalance = 'Error'; }

        res.json({
            fivesim: fsBalance,
            smsactivate: saBalance
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- BOT MANAGEMENT ---
router.get('/bot/status', (req, res) => {
    try {
        const status = getBotStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/bot/pair', async (req, res) => {
    const { phone } = req.body;
    try {
        const code = await triggerPairingCode(phone);
        res.json({ success: true, code });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
