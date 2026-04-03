const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const adminRoutes = require('./api/admin.routes');

function startServer() {
    const app = express();
    const port = process.env.PORT || 3000;

    // Middleware
    app.use(helmet({
        contentSecurityPolicy: false, // Disabled for simple dashboard serving
    }));
    app.use(cors());
    app.use(express.json());

    // API Routes
    app.use('/api', adminRoutes);

    // Serve Frontend
    const dashboardPath = path.join(__dirname, '../dashboard/dist');
    app.use(express.static(dashboardPath));

    // Fallback for SPA routing
    app.get(/^\/(.*)/, (req, res) => {
        res.sendFile(path.join(dashboardPath, 'index.html'));
    });

    app.listen(port, () => {
        console.log(`🚀 Admin Dashboard API running on http://localhost:${port}`);
    });
}

module.exports = { startServer };
