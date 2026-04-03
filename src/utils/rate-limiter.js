class RateLimiter {
    constructor(limit = 3, interval = 2000) {
        this.limit = limit;
        this.interval = interval;
        this.requests = new Map();
    }

    isRateLimited(jid) {
        const now = Date.now();
        const userRequests = this.requests.get(jid) || [];
        
        // Filter requests within the current interval
        const recentRequests = userRequests.filter(timestamp => now - timestamp < this.interval);
        
        if (recentRequests.length >= this.limit) {
            return true;
        }

        recentRequests.push(now);
        this.requests.set(jid, recentRequests);
        return false;
    }

    // Cleanup old entries to prevent memory leak
    cleanup() {
        const now = Date.now();
        for (const [jid, timestamps] of this.requests.entries()) {
            const validTimestamps = timestamps.filter(timestamp => now - timestamp < this.interval);
            if (validTimestamps.length === 0) {
                this.requests.delete(jid);
            } else {
                this.requests.set(jid, validTimestamps);
            }
        }
    }
}

// Default: 3 commands per 2 seconds
module.exports = new RateLimiter();
