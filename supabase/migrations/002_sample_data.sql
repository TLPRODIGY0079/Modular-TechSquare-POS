-- Sample Data for TECHSQUARE POS
-- This file inserts sample data for testing purposes

-- Insert sample users (you'll need to create these in Supabase Auth first)
-- Note: These IDs should match the actual user IDs from Supabase Auth

-- Sample products
INSERT INTO products (name, description, category, brand, cost_price, is_active) VALUES
    ('iPhone 14 Pro', 'Latest iPhone with A16 chip', 'Smartphones', 'Apple', 800.00, true),
    ('Samsung Galaxy S23', 'Flagship Android smartphone', 'Smartphones', 'Samsung', 700.00, true),
    ('MacBook Air M2', '13-inch laptop with M2 chip', 'Laptops', 'Apple', 900.00, true),
    ('Dell XPS 15', '15-inch Windows laptop', 'Laptops', 'Dell', 850.00, true),
    ('AirPods Pro 2', 'Wireless earbuds with noise cancellation', 'Audio', 'Apple', 150.00, true)
ON CONFLICT DO NOTHING;

-- Sample variants (assuming products were inserted with IDs 1-5)
INSERT INTO variants (product_id, sku, color, storage, price, cost_price, commission_rate, qty, store_id, is_active) VALUES
    -- iPhone 14 Pro variants
    ((SELECT id FROM products WHERE name = 'iPhone 14 Pro' LIMIT 1), 'IP14P-128-BLK', 'Black', '128GB', 999.99, 800.00, 2.5, 25, '00000000-0000-0000-0000-000000000001', true),
    ((SELECT id FROM products WHERE name = 'iPhone 14 Pro' LIMIT 1), 'IP14P-256-WHT', 'White', '256GB', 1099.99, 900.00, 2.5, 20, '00000000-0000-0000-0000-000000000001', true),
    ((SELECT id FROM products WHERE name = 'iPhone 14 Pro' LIMIT 1), 'IP14P-128-BLU', 'Blue', '128GB', 999.99, 800.00, 2.5, 15, '00000000-0000-0000-0000-000000000002', true),
    
    -- Samsung Galaxy S23 variants
    ((SELECT id FROM products WHERE name = 'Samsung Galaxy S23' LIMIT 1), 'S23-128-PHM', 'Phantom Black', '128GB', 799.99, 700.00, 3.0, 30, '00000000-0000-0000-0000-000000000001', true),
    ((SELECT id FROM products WHERE name = 'Samsung Galaxy S23' LIMIT 1), 'S23-256-CRM', 'Cream', '256GB', 899.99, 750.00, 3.0, 18, '00000000-0000-0000-0000-000000000002', true),
    
    -- MacBook Air M2 variants
    ((SELECT id FROM products WHERE name = 'MacBook Air M2' LIMIT 1), 'MBA-M2-256-SLV', 'Silver', '256GB', 1199.99, 900.00, 2.0, 12, '00000000-0000-0000-0000-000000000001', true),
    ((SELECT id FROM products WHERE name = 'MacBook Air M2' LIMIT 1), 'MBA-M2-512-GRY', 'Space Gray', '512GB', 1399.99, 1100.00, 2.0, 8, '00000000-0000-0000-0000-000000000002', true),
    
    -- Dell XPS 15 variants
    ((SELECT id FROM products WHERE name = 'Dell XPS 15' LIMIT 1), 'DELL-XPS15-512', 'Silver', '512GB', 1499.99, 850.00, 2.5, 10, '00000000-0000-0000-0000-000000000001', true),
    
    -- AirPods Pro 2 variants
    ((SELECT id FROM products WHERE name = 'AirPods Pro 2' LIMIT 1), 'APP2-WHT', 'White', 'N/A', 249.99, 150.00, 5.0, 50, '00000000-0000-0000-0000-000000000001', true),
    ((SELECT id FROM products WHERE name = 'AirPods Pro 2' LIMIT 1), 'APP2-WHT', 'White', 'N/A', 249.99, 150.00, 5.0, 35, '00000000-0000-0000-0000-000000000002', true)
ON CONFLICT (sku) DO NOTHING;

-- Sample serialized items (for high-value items)
INSERT INTO serialized_items (variant_id, serial_number, imei, condition, status, store_id) VALUES
    ((SELECT id FROM variants WHERE sku = 'IP14P-128-BLK' LIMIT 1), 'SN1234567890', 'IMEI123456789012', 'new', 'available', '00000000-0000-0000-0000-000000000001'),
    ((SELECT id FROM variants WHERE sku = 'IP14P-128-BLK' LIMIT 1), 'SN1234567891', 'IMEI123456789013', 'new', 'available', '00000000-0000-0000-0000-000000000001'),
    ((SELECT id FROM variants WHERE sku = 'IP14P-256-WHT' LIMIT 1), 'SN1234567892', 'IMEI123456789014', 'new', 'available', '00000000-0000-0000-0000-000000000001'),
    ((SELECT id FROM variants WHERE sku = 'S23-128-PHM' LIMIT 1), 'SN9876543210', 'IMEI987654321012', 'new', 'available', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (serial_number) DO NOTHING;

-- Sample expense categories (for reference)
-- These are used in the expenses module but stored as text, not in a separate table

-- Sample commission rates setup
-- These are stored in the variants table as commission_rate

-- Notes:
-- 1. User IDs in user_profiles should match actual Supabase Auth user IDs
-- 2. Store IDs use the predefined UUIDs from the initial schema
-- 3. You may want to adjust quantities and prices based on your needs
-- 4. Remove this data before production deployment