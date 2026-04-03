const axios = require('axios');
require('dotenv').config();

class SmsActivateAPI {
    constructor() {
        this.apiKey = process.env.SMSACTIVATE_API_KEY;
        this.baseUrl = 'https://api.sms-activate.org/stubs/handler_api.php';
    }

    async getBalance() {
        try {
            const response = await axios.get(`${this.baseUrl}?api_key=${this.apiKey}&action=getBalance`);
            // Format: ACCESS_BALANCE:100.00
            if (response.data.includes('ACCESS_BALANCE')) {
                return parseFloat(response.data.split(':')[1]);
            }
            throw new Error(response.data);
        } catch (error) {
            console.error('SMS-Activate Balance Error:', error.message);
            throw error;
        }
    }

    async buyNumber(service, country) {
        try {
            const response = await axios.get(`${this.baseUrl}?api_key=${this.apiKey}&action=getNumber&service=${service}&country=${country}`);
            // Format: ACCESS_NUMBER:ID:NUMBER
            if (response.data.includes('ACCESS_NUMBER')) {
                const [, id, number] = response.data.split(':');
                return { id, number };
            }
            throw new Error(response.data);
        } catch (error) {
            console.error('SMS-Activate Buy Error:', error.message);
            throw error;
        }
    }

    async getStatus(id) {
        try {
            const response = await axios.get(`${this.baseUrl}?api_key=${this.apiKey}&action=getStatus&id=${id}`);
            // Format: STATUS_OK:CODE or STATUS_WAIT_CODE etc.
            if (response.data.includes('STATUS_OK')) {
                return { status: 'success', code: response.data.split(':')[1] };
            }
            return { status: response.data };
        } catch (error) {
            console.error('SMS-Activate Status Error:', error.message);
            throw error;
        }
    }

    async setStatus(id, status) {
        // status 1: confirm, 3: retry, 6: cancel, 8: finish
        try {
            const response = await axios.get(`${this.baseUrl}?api_key=${this.apiKey}&action=setStatus&id=${id}&status=${status}`);
            return response.data;
        } catch (error) {
            console.error('SMS-Activate SetStatus Error:', error.message);
            throw error;
        }
    }
}

module.exports = new SmsActivateAPI();
