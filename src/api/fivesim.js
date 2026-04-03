const axios = require('axios');
require('dotenv').config();

class FiveSimAPI {
    constructor() {
        this.apiKey = process.env.FIVESIM_API_KEY;
        this.baseUrl = 'https://5sim.net/v1';
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Accept': 'application/json'
            }
        });
    }

    async getBalance() {
        try {
            const response = await this.client.get('/user/profile');
            return response.data.balance;
        } catch (error) {
            console.error('5SIM Balance Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async buyNumber(country, operator, service) {
        try {
            const response = await this.client.get(`/user/buy/activation/${country}/${operator}/${service}`);
            return response.data; // { id, phone, operator, product, price, status, ... }
        } catch (error) {
            console.error('5SIM Buy Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async checkOrder(orderId) {
        try {
            const response = await this.client.get(`/user/check/${orderId}`);
            return response.data; // { id, phone, sms: [{ code, sender, text, date }], ... }
        } catch (error) {
            console.error('5SIM Check Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async finishOrder(orderId) {
        try {
            const response = await this.client.get(`/user/finish/${orderId}`);
            return response.data;
        } catch (error) {
            console.error('5SIM Finish Error:', error.response?.data || error.message);
            throw error;
        }
    }

    async cancelOrder(orderId) {
        try {
            const response = await this.client.get(`/user/cancel/${orderId}`);
            return response.data;
        } catch (error) {
            console.error('5SIM Cancel Error:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new FiveSimAPI();
