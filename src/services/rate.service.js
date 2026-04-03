const supabase = require('../database/supabase');

class RateService {
    async getAllRates() {
        const { data, error } = await supabase
            .from('rates')
            .select('*')
            .order('country_code', { ascending: true });

        if (error) {
            console.error('Supabase GetRates Error:', error.message);
            throw error;
        }
        return data;
    }

    async getRate(countryCode, serviceCode) {
        const { data, error } = await supabase
            .from('rates')
            .select('*')
            .eq('country_code', countryCode.toUpperCase())
            .eq('service_code', serviceCode.toLowerCase())
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Supabase GetRate Error:', error.message);
        }
        return data;
    }

    formatRateList(rates) {
        if (!rates || rates.length === 0) return 'No rates available at the moment.';
        
        let message = '💰 *Current OTP Rates* \n\n';
        message += 'Country | Service | Price\n';
        message += '--------------------------\n';
        
        rates.forEach(r => {
            message += `${r.country_code} | ${r.display_name} | ₦${r.price}\n`;
        });
        
        message += '\nUse `.get <country> <service>` to buy.';
        return message;
    }
}

module.exports = new RateService();
