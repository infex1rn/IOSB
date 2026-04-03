const orderService = require('./order.service');
const fivesim = require('../api/fivesim');
const smsactivate = require('../api/smsactivate');

class PollingService {
    constructor() {
        this.intervalId = null;
        this.isPolling = false;
        this.sock = null;
    }

    start(sock) {
        this.sock = sock;
        if (this.intervalId) return;
        
        console.log('Starting Background Order Poller (5s interval)...');
        this.intervalId = setInterval(() => this.pollOrders(), 5000);
    }

    async pollOrders() {
        if (this.isPolling) return;
        this.isPolling = true;

        try {
            const waitingOrders = await orderService.getWaitingOrders();
            if (waitingOrders.length === 0) {
                this.isPolling = false;
                return;
            }

            for (const order of waitingOrders) {
                await this.processOrder(order);
            }
        } catch (error) {
            console.error('Polling Error:', error.message);
        } finally {
            this.isPolling = false;
        }
    }

    async processOrder(order) {
        // 1. Check for timeout (15 mins)
        const now = new Date();
        const expiresAt = new Date(order.expires_at);
        if (now > expiresAt) {
            console.log(`Order ${order.id} timed out. Refunding...`);
            await this.cancelAndRefund(order, 'Timed out');
            return;
        }

        // 2. Poll Upstream API
        try {
            // Check 5SIM (Assuming default for now)
            const check = await fivesim.checkOrder(order.id);
            
            if (check.sms && check.sms.length > 0) {
                const otpCode = check.sms[0].code;
                console.log(`SMS received for ${order.id}: ${otpCode}`);
                
                // Mark success and send message
                await orderService.updateOrderStatus(order.id, 'success', otpCode);
                await this.sock.sendMessage(order.user_id, { 
                    text: `✅ *OTP Received!* \n\nNumber: ${order.number}\nCode: *${otpCode}*\n\nOrder #${order.id} completed.` 
                });
                
                // Finish order in 5SIM
                await fivesim.finishOrder(order.id);
            } else if (check.status === 'CANCELED') {
                await this.cancelAndRefund(order, 'Cancelled by Provider');
            }
        } catch (error) {
            console.error(`Check order error (${order.id}):`, error.message);
        }
    }

    async cancelAndRefund(order, reason) {
        try {
            await fivesim.cancelOrder(order.id);
            await orderService.refundOrder(order);
            await this.sock.sendMessage(order.user_id, { 
                text: `❌ *Order Cancelled* \n\nReason: ${reason}\nOrder ID: ${order.id}\nYour balance of ₦${order.cost} has been refunded.` 
            });
        } catch (error) {
            console.error(`Refund error for ${order.id}:`, error.message);
        }
    }
}

module.exports = new PollingService();
