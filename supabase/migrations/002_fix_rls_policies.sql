-- Fix RLS policies to allow store managers and cashiers to manage products and variants

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can manage variants" ON variants;

-- Drop existing inclusive policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins and managers can insert products" ON products;
DROP POLICY IF EXISTS "Admins and managers can update products" ON products;
DROP POLICY IF EXISTS "Admins and managers can manage variants" ON variants;

-- Create new inclusive policies for products (INSERT and UPDATE only)
CREATE POLICY "Admins and managers can insert products" ON products FOR INSERT WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles WHERE role IN ('admin', 'store_manager', 'cashier')
    )
);
CREATE POLICY "Admins and managers can update products" ON products FOR UPDATE USING (
    auth.uid() IN (
        SELECT id FROM user_profiles WHERE role IN ('admin', 'store_manager', 'cashier')
    )
);

-- Create new inclusive policies for variants (ALL operations)
CREATE POLICY "Admins and managers can manage variants" ON variants FOR ALL USING (
    auth.uid() IN (
        SELECT id FROM user_profiles WHERE role IN ('admin', 'store_manager', 'cashier')
    )
);
