-- TECHSQUARE POS Initial Schema
-- This file creates the initial database structure for the POS system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email TEXT,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'store_manager', 'warehouse_manager', 'cashier')),
    store_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    brand TEXT,
    cost_price DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Variants Table
CREATE TABLE IF NOT EXISTS variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT UNIQUE NOT NULL,
    color TEXT,
    storage TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2) DEFAULT 0,
    commission_rate DECIMAL(5,2) DEFAULT 0,
    qty INTEGER DEFAULT 0,
    store_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Serialized Items Table
CREATE TABLE IF NOT EXISTS serialized_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id UUID REFERENCES variants(id) ON DELETE CASCADE,
    serial_number TEXT UNIQUE NOT NULL,
    imei TEXT,
    condition TEXT CHECK (condition IN ('new', 'used', 'refurbished')),
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'sold', 'reserved', 'transfer')),
    store_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL,
    user_id UUID REFERENCES user_profiles(id),
    user_name TEXT,
    receipt_number TEXT UNIQUE NOT NULL,
    product_name TEXT NOT NULL,
    sku TEXT,
    variant_label TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    profit DECIMAL(10,2) DEFAULT 0,
    commission_rate DECIMAL(5,2) DEFAULT 0,
    payment_method TEXT,
    agent_id UUID REFERENCES user_profiles(id),
    customer_name TEXT,
    identifier TEXT,
    date_str TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock Transfers Table
CREATE TABLE IF NOT EXISTS stock_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_store_id UUID NOT NULL,
    to_store_id UUID NOT NULL,
    variant_id UUID REFERENCES variants(id),
    quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
    requested_by UUID REFERENCES user_profiles(id),
    approved_by UUID REFERENCES user_profiles(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Trade-In Transactions Table
CREATE TABLE IF NOT EXISTS trade_in_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL,
    user_id UUID REFERENCES user_profiles(id),
    user_name TEXT,
    item_name TEXT NOT NULL,
    item_description TEXT,
    serial_number TEXT,
    condition TEXT CHECK (condition IN ('new', 'used', 'refurbished', 'damaged')),
    trade_in_value DECIMAL(10,2) DEFAULT 0,
    sale_value DECIMAL(10,2) DEFAULT 0,
    customer_name TEXT,
    customer_phone TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL,
    user_id UUID REFERENCES user_profiles(id),
    user_name TEXT,
    category TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Layby Transactions Table
CREATE TABLE IF NOT EXISTS layby_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL,
    user_id UUID REFERENCES user_profiles(id),
    user_name TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    product_name TEXT NOT NULL,
    variant_id UUID REFERENCES variants(id),
    total_price DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2) DEFAULT 0,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    balance DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    start_date DATE NOT NULL,
    completion_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Layby Payments Table
CREATE TABLE IF NOT EXISTS layby_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    layby_id UUID REFERENCES layby_transactions(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT,
    user_id UUID REFERENCES user_profiles(id),
    user_name TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Commission Records Table
CREATE TABLE IF NOT EXISTS commission_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES user_profiles(id),
    agent_name TEXT,
    store_id UUID,
    receipt_number TEXT,
    total_amount DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 0,
    commission_amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    items JSONB,
    sale_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- Stock Requests Table (for warehouse operations)
CREATE TABLE IF NOT EXISTS stock_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL,
    user_id UUID REFERENCES user_profiles(id),
    user_name TEXT,
    variant_id UUID REFERENCES variants(id),
    product_name TEXT,
    sku TEXT,
    quantity_requested INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_store_id ON variants(store_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON variants(sku);
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_date_str ON sales(date_str);
CREATE INDEX IF NOT EXISTS idx_sales_agent_id ON sales(agent_id);
CREATE INDEX IF NOT EXISTS idx_serialized_items_variant_id ON serialized_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_serialized_items_store_id ON serialized_items(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_store ON stock_transfers(from_store_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_store ON stock_transfers(to_store_id);
CREATE INDEX IF NOT EXISTS idx_layby_transactions_customer ON layby_transactions(customer_name);
CREATE INDEX IF NOT EXISTS idx_commission_records_agent ON commission_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_status ON commission_records(status);
CREATE INDEX IF NOT EXISTS idx_stock_requests_status ON stock_requests(status);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE serialized_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_in_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE layby_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE layby_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for products
CREATE POLICY "All authenticated users can view products" ON products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert products" ON products FOR INSERT WITH CHECK (auth.uid() IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
));
CREATE POLICY "Admins can update products" ON products FOR UPDATE USING (auth.uid() IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
));

-- RLS Policies for variants
CREATE POLICY "All authenticated users can view variants" ON variants FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage variants" ON variants FOR ALL USING (auth.uid() IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
));

-- RLS Policies for sales
CREATE POLICY "Users can view own store sales" ON sales FOR SELECT USING (
    store_id = (SELECT store_id FROM user_profiles WHERE id = auth.uid()) OR
    (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('admin', 'store_manager')
);
CREATE POLICY "Users can insert sales" ON sales FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Similar RLS policies should be created for all other tables based on your security requirements

-- Insert default stores
INSERT INTO variants (id, sku, name, price, store_id, is_active) VALUES
    ('00000000-0000-0000-0000-000000000001', 'STORE-1', 'Store 1', 0, '00000000-0000-0000-0000-000000000001', true),
    ('00000000-0000-0000-0000-000000000002', 'STORE-2', 'Store 2', 0, '00000000-0000-0000-0000-000000000002', true)
ON CONFLICT (id) DO NOTHING;