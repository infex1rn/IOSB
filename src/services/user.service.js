const supabase = require('../database/supabase');

class UserService {
    async getUser(jid) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', jid)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
            console.error('Supabase GetUser Error:', error.message);
        }
        return data;
    }

    async registerUser(userData) {
        const { data, error } = await supabase
            .from('users')
            .insert([userData])
            .select()
            .single();

        if (error) {
            console.error('Supabase Register Error:', error.message);
            throw error;
        }
        return data;
    }

    async updateBalance(jid, amount, type, referenceId = null) {
        // Atomic balance update using a transaction-like approach
        // 1. Get current balance
        const user = await this.getUser(jid);
        if (!user) throw new Error('User not found');

        const previousBalance = user.balance;
        const newBalance = previousBalance + amount;

        if (newBalance < 0) throw new Error('Insufficient balance');

        // 2. Perform updates and log transaction
        const { error: updateError } = await supabase
            .rpc('adjust_balance', { user_id_param: jid, amount_param: amount });

        if (updateError) {
            console.error('Supabase Balance Update Error:', updateError.message);
            throw updateError;
        }

        // 3. Log transaction
        await supabase.from('transactions').insert([{
            reference_id: referenceId || `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            user_id: jid,
            type: type,
            amount: amount,
            previous_balance: previousBalance,
            new_balance: newBalance,
            status: 'completed'
        }]);

        return newBalance;
    }
}

module.exports = new UserService();
