const supabase = require('../database/supabase');
const userService = require('./user.service');

class OrderService {
    async createOrder(orderData) {
        const { data, error } = await supabase
            .from('orders')
            .insert([orderData])
            .select()
            .single();

        if (error) {
            console.error('Supabase CreateOrder Error:', error.message);
            throw error;
        }
        return data;
    }

    async getActiveOrder(jid) {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', jid)
            .eq('status', 'waiting')
            .maybeSingle();

        if (error) {
            console.error('Supabase GetActiveOrder Error:', error.message);
        }
        return data;
    }

    async updateOrderStatus(orderId, status, otp = null) {
        const updateData = { status };
        if (otp) updateData.otp = otp;

        const { data, error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId)
            .select()
            .single();

        if (error) {
            console.error('Supabase UpdateOrder Error:', error.message);
            throw error;
        }
        return data;
    }

    async getWaitingOrders() {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('status', 'waiting');

        if (error) {
            console.error('Supabase GetWaitingOrders Error:', error.message);
            return [];
        }
        return data;
    }

    async refundOrder(order) {
        try {
            await userService.updateBalance(
                order.user_id, 
                order.cost, 
                'refund', 
                `REFUND-${order.id}`
            );
            await this.updateOrderStatus(order.id, 'cancelled');
            return true;
        } catch (error) {
            console.error(`Refund failed for order ${order.id}:`, error.message);
            return false;
        }
    }
}

module.exports = new OrderService();
