class SessionService {
    constructor() {
        this.registrationSessions = new Map();
    }

    startRegistration(jid) {
        this.registrationSessions.set(jid, { step: 'AWAITING_NAME' });
    }

    getRegistrationSession(jid) {
        return this.registrationSessions.get(jid);
    }

    updateRegistrationSession(jid, data) {
        const session = this.getRegistrationSession(jid);
        if (session) {
            this.registrationSessions.set(jid, { ...session, ...data });
        }
    }

    clearRegistrationSession(jid) {
        this.registrationSessions.delete(jid);
    }

    isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
}

module.exports = new SessionService();
