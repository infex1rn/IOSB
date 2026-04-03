const userService = require('../services/user.service');
const sessionService = require('../services/session.service');
const rateService = require('../services/rate.service');
const orderService = require('../services/order.service');
const fivesim = require('../api/fivesim');
const rateLimiter = require('../utils/rate-limiter');
require('dotenv').config();

const ADMIN_PHONE = process.env.ADMIN_PHONE;
const BOT_NAME = process.env.BOT_NAME || 'OTP Service Bot';
const CURRENCY_SYMBOL = process.env.CURRENCY_SYMBOL || '₦';

let maintenanceMode = false;

const commands = {
    '.start': `Welcome to ${BOT_NAME}! Use .reg to get started.`,
    '.command': `Available Commands:\n.start - Introduction\n.reg - Register\n.rate - Check Prices\n.menu - Dashboard\n.balance - Check Balance\n.deposit - Fund Wallet\n.get <country> <service> - Buy Number\n.cancel - Cancel Order\n.apply vendor - Become a Vendor\n.support - Contact Admin`,
    '.support': `Contact our admin at ${ADMIN_PHONE}.`
};

async function handleMessage(sock, m) {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const remoteJid = msg.key.remoteJid;
    const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
    
    // 0. Rate Limiting Check
    if (rateLimiter.isRateLimited(remoteJid)) {
        console.warn(`Rate limit exceeded for: ${remoteJid}`);
        // Optional: Send a rate limit warning message once per interval
        return;
    }

    // 1. Check registration session
    const session = sessionService.getRegistrationSession(remoteJid);
    if (session) {
        await handleRegistration(sock, remoteJid, text, session);
        return;
    }

    if (!text.startsWith('.')) return;

    const args = text.split(/\s+/);
    const command = args[0].toLowerCase();

    console.log(`Processing command: ${command} from ${remoteJid}`);

    // 2. Fetch User
    const user = await userService.getUser(remoteJid);

    // 3. Command Routing
    if (command === '.reg') {
        if (user) {
            await sock.sendMessage(remoteJid, { text: 'You are already registered! Use .menu to see your dashboard.' });
        } else {
            sessionService.startRegistration(remoteJid);
            await sock.sendMessage(remoteJid, { text: `Welcome to ${BOT_NAME}! Please reply with your full name to start registration.` });
        }
        return;
    }

    if (!user && !['.start', '.command', '.admin'].includes(command)) {
        await sock.sendMessage(remoteJid, { text: 'You must register first! Send .reg to start.' });
        return;
    }

    if (command === '.admin') {
        await handleAdminCommand(sock, remoteJid, args);
        return;
    }

    // Upstream Kill Switch Check
    if (maintenanceMode && !['.start', '.command', '.support', '.balance'].includes(command)) {
        await sock.sendMessage(remoteJid, { text: `⚙️ ${BOT_NAME} is currently in maintenance mode. Only balance and support commands are active.` });
        return;
    }

    switch (command) {
        case '.menu':
            const dashboard = `👤 *Dashboard* \n\nName: ${user.name}\nBalance: ${CURRENCY_SYMBOL}${user.balance}\nRole: ${user.role}\nStatus: ${user.status}`;
            await sock.sendMessage(remoteJid, { text: dashboard });
            break;

        case '.balance':
            await sock.sendMessage(remoteJid, { text: `Your current balance is: ${CURRENCY_SYMBOL}${user.balance}` });
            break;

        case '.rate':
            try {
                const allRates = await rateService.getAllRates();
                const rateMsg = rateService.formatRateList(allRates);
                await sock.sendMessage(remoteJid, { text: rateMsg });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: 'Error fetching rates. Please try again later.' });
            }
            break;

        case '.deposit':
            const depositMsg = `💳 *Fund Your Wallet* \n\nTo fund your wallet, please make a transfer to the account details provided by ${ADMIN_PHONE}.\n\nSend a screenshot to Admin after payment for confirmation.`;
            await sock.sendMessage(remoteJid, { text: depositMsg });
            break;

        case '.get':
            if (args.length < 3) {
                await sock.sendMessage(remoteJid, { text: 'Usage: `.get <country> <service>` (e.g., .get USA ws)' });
                return;
            }
            await handlePurchase(sock, remoteJid, user, args[1], args[2]);
            break;

        case '.cancel':
            await handleCancel(sock, remoteJid);
            break;

        case '.apply':
            if (args[1]?.toLowerCase() === 'vendor') {
                if (user.role === 'vendor') {
                    await sock.sendMessage(remoteJid, { text: 'You are already a vendor!' });
                } else {
                    await sock.sendMessage(remoteJid, { text: `Application submitted! Admin will review your profile shortly.` });
                    await sock.sendMessage(`${ADMIN_PHONE}@s.whatsapp.net`, { text: `🔔 *Vendor Application* \n\nPhone: ${user.phone}\nName: ${user.name}\nUse \`.admin approve ${user.phone}\` to promote.` });
                }
            } else {
                await sock.sendMessage(remoteJid, { text: 'Usage: `.apply vendor`' });
            }
            break;

        case '.bulk':
            if (user.role !== 'vendor') {
                await sock.sendMessage(remoteJid, { text: '❌ Only vendors can use the .bulk command.' });
                return;
            }
            await sock.sendMessage(remoteJid, { text: 'Bulk purchasing is being optimized for non-blocking concurrent requests.' });
            break;

        default:
            if (commands[command]) {
                await sock.sendMessage(remoteJid, { text: commands[command] });
            } else {
                await sock.sendMessage(remoteJid, { text: 'Unknown command. Use .command to see available options.' });
            }
    }
}

async function handlePurchase(sock, jid, user, country, service) {
    const activeOrder = await orderService.getActiveOrder(jid);
    if (activeOrder) {
        await sock.sendMessage(jid, { text: `❌ You already have an active order (#${activeOrder.id}). Use .cancel to refund first.` });
        return;
    }

    const rate = await rateService.getRate(country, service);
    if (!rate) {
        await sock.sendMessage(jid, { text: `❌ Service not found or rate not available.` });
        return;
    }

    let finalPrice = rate.price;
    if (user.role === 'vendor') {
        finalPrice = Math.floor(rate.price * 0.9); // 10% discount for vendors
    }

    if (user.balance < finalPrice) {
        await sock.sendMessage(jid, { text: `❌ Insufficient balance! Required: ${CURRENCY_SYMBOL}${finalPrice}.` });
        return;
    }

    try {
        await sock.sendMessage(jid, { text: `⏳ Requesting number...` });
        const upstream = await fivesim.buyNumber(country, 'any', service);
        await userService.updateBalance(jid, -finalPrice, 'purchase', `PURCHASE-${upstream.id}`);

        const orderData = {
            id: upstream.id.toString(),
            user_id: jid,
            type: 'otp',
            service: service,
            country: country,
            number: upstream.phone,
            status: 'waiting',
            cost: finalPrice,
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };

        await orderService.createOrder(orderData);
        await sock.sendMessage(jid, { text: `✅ *Number Purchased!* \n\nNumber: *${upstream.phone}*\nCost: ${CURRENCY_SYMBOL}${finalPrice}\n\nWaiting for SMS... (Valid for 15 mins).` });

    } catch (error) {
        if (error.message.includes('not enough money')) {
            maintenanceMode = true;
            await sock.sendMessage(`${ADMIN_PHONE}@s.whatsapp.net`, { text: `⚠️ *URGENT:* Upstream (5SIM) balance is exhausted! Bot has switched to maintenance mode.` });
        }
        await sock.sendMessage(jid, { text: `❌ Purchase failed: ${error.message}` });
    }
}

async function handleCancel(sock, jid) {
    const activeOrder = await orderService.getActiveOrder(jid);
    if (!activeOrder) {
        await sock.sendMessage(jid, { text: '❌ No active waiting orders.' });
        return;
    }

    try {
        await sock.sendMessage(jid, { text: `⏳ Cancelling...` });
        await fivesim.cancelOrder(activeOrder.id);
        await orderService.refundOrder(activeOrder);
        await sock.sendMessage(jid, { text: `✅ Order #${activeOrder.id} cancelled and refunded.` });
    } catch (error) {
        await sock.sendMessage(jid, { text: `❌ Cancellation error: ${error.message}` });
    }
}

async function handleAdminCommand(sock, jid, args) {
    const senderPhone = jid.split('@')[0];
    if (senderPhone !== ADMIN_PHONE) {
        await sock.sendMessage(jid, { text: '❌ Access Denied.' });
        return;
    }

    const subCommand = args[1]?.toLowerCase();
    switch (subCommand) {
        case 'fund':
            const targetPhone = args[2];
            const amount = parseInt(args[3]);
            if (!targetPhone || isNaN(amount)) {
                await sock.sendMessage(jid, { text: 'Usage: `.admin fund <phone> <amount>`' });
                return;
            }
            try {
                const targetJid = `${targetPhone}@s.whatsapp.net`;
                const newBalance = await userService.updateBalance(targetJid, amount, 'deposit', `ADMIN-FUND-${Date.now()}`);
                await sock.sendMessage(jid, { text: `✅ Funded ${targetPhone}. New balance: ${CURRENCY_SYMBOL}${newBalance}` });
                await sock.sendMessage(targetJid, { text: `🔔 Your account has been funded with ${CURRENCY_SYMBOL}${amount}.` });
            } catch (error) {
                await sock.sendMessage(jid, { text: `❌ Error: ${error.message}` });
            }
            break;

        case 'approve':
            const vendorPhone = args[2];
            if (!vendorPhone) {
                await sock.sendMessage(jid, { text: 'Usage: `.admin approve <phone>`' });
                return;
            }
            try {
                const vendorJid = `${vendorPhone}@s.whatsapp.net`;
                const { error } = await require('../database/supabase')
                    .from('users')
                    .update({ role: 'vendor' })
                    .eq('id', vendorJid);
                if (error) throw error;
                await sock.sendMessage(jid, { text: `✅ User ${vendorPhone} promoted to vendor.` });
                await sock.sendMessage(vendorJid, { text: `🎉 *Congratulations!* Your vendor application has been approved. You now enjoy discounted rates and bulk ordering.` });
            } catch (error) {
                await sock.sendMessage(jid, { text: `❌ Error: ${error.message}` });
            }
            break;

        case 'maintenance':
            maintenanceMode = !maintenanceMode;
            await sock.sendMessage(jid, { text: `🛠 Maintenance mode: *${maintenanceMode ? 'ENABLED' : 'DISABLED'}*` });
            break;

        default:
            await sock.sendMessage(jid, { text: 'Admin Commands:\n.admin fund <phone> <amount>\n.admin approve <phone>\n.admin maintenance' });
    }
}

async function handleRegistration(sock, jid, text, session) {
    if (session.step === 'AWAITING_NAME') {
        sessionService.updateRegistrationSession(jid, { name: text, step: 'AWAITING_EMAIL' });
        await sock.sendMessage(jid, { text: 'Now please provide your email address.' });
    } else if (session.step === 'AWAITING_EMAIL') {
        if (!sessionService.isValidEmail(text)) {
            await sock.sendMessage(jid, { text: 'Invalid email format.' });
            return;
        }
        try {
            const userData = { id: jid, phone: jid.split('@')[0], name: session.name, email: text, balance: 0, role: 'user', status: 'active' };
            await userService.registerUser(userData);
            sessionService.clearRegistrationSession(jid);
            await sock.sendMessage(jid, { text: `Registration successful! Use .menu to access ${BOT_NAME}.` });
        } catch (error) {
            await sock.sendMessage(jid, { text: 'Error during registration.' });
        }
    }
}

module.exports = { handleMessage };
