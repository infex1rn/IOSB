-- ==========================================
-- IOSB: INSTANT OTP SERVICE BOT MIGRATION
-- ==========================================

-- 1. Users Table
-- Stores user profiles, balances, and roles.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,        -- WhatsApp JID (e.g., 2348012345678@s.whatsapp.net)
  phone TEXT UNIQUE NOT NULL, -- Extracted phone number
  name TEXT,
  email TEXT,
  balance BIGINT DEFAULT 0,   -- Store in minor units (e.g., 5000 = 50.00)
  role TEXT DEFAULT 'user',   -- user | vendor | admin
  status TEXT DEFAULT 'active',
  total_spent BIGINT DEFAULT 0,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Rates Table
-- Stores dynamic pricing for country-service pairs.
CREATE TABLE IF NOT EXISTS rates (
  id SERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,
  service_code TEXT NOT NULL,
  price BIGINT NOT NULL,
  display_name TEXT NOT NULL,
  UNIQUE(country_code, service_code)
);

-- 3. Orders Table
-- Tracks OTP purchases and their real-time statuses.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,        -- Upstream Order ID (5SIM / SMS-Activate)
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'otp',
  service TEXT NOT NULL,
  country TEXT NOT NULL,
  number TEXT NOT NULL,
  status TEXT DEFAULT 'waiting', -- waiting | success | failed | cancelled
  otp TEXT,
  cost BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- 4. Transactions Table
-- Logs every financial movement (deposit, purchase, refund).
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  reference_id TEXT UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,         -- deposit | withdraw | purchase | refund
  amount BIGINT NOT NULL,
  previous_balance BIGINT NOT NULL,
  new_balance BIGINT NOT NULL,
  status TEXT DEFAULT 'completed',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Baileys Auth Table
-- Stores WhatsApp session state in the database for stateless persistence.
CREATE TABLE IF NOT EXISTS baileys_auth (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- ==========================================
-- FUNCTIONS & PROCEDURES
-- ==========================================

-- Atomic Balance Update Function
-- Ensures balance updates are safe and free from race conditions.
CREATE OR REPLACE FUNCTION adjust_balance(user_id_param TEXT, amount_param BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE users 
  SET balance = balance + amount_param 
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_rates_country_service ON rates(country_code, service_code);

-- ==========================================
-- END OF MIGRATION
-- ==========================================
