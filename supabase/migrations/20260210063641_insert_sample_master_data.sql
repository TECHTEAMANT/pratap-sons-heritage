/*
  # Insert Sample Master Data
  
  This migration adds sample data for:
  - Product Groups (Lehenga, Salwar Suit, Saree, One-Piece)
  - Colors (Red, Blue, Green, Black, White, Pink, Yellow, Orange)
  - Sizes (XS, S, M, L, XL, XXL, Free)
  - Vendors (Sample vendors)
  - Floors (Ground Floor, First Floor, Second Floor)
  
  This allows immediate testing and use of the system.
*/

-- Insert Product Groups
INSERT INTO product_groups (group_code, name, description, hsn_code) VALUES
('LH', 'Lehenga', 'Traditional Indian Lehenga', '62043000'),
('SS', 'Salwar Suit', 'Salwar Kameez Sets', '62044000'),
('SR', 'Saree', 'Traditional Indian Saree', '62041000'),
('OP', 'One-Piece', 'Western One-Piece Dresses', '62044300'),
('KT', 'Kurti', 'Indian Kurti/Tops', '62046000')
ON CONFLICT (group_code) DO NOTHING;

-- Insert Colors
INSERT INTO colors (color_code, name, hex_value) VALUES
('RD', 'Red', '#FF0000'),
('BL', 'Blue', '#0000FF'),
('GR', 'Green', '#00FF00'),
('BK', 'Black', '#000000'),
('WH', 'White', '#FFFFFF'),
('PK', 'Pink', '#FFC0CB'),
('YL', 'Yellow', '#FFFF00'),
('OR', 'Orange', '#FFA500'),
('PU', 'Purple', '#800080'),
('GY', 'Grey', '#808080'),
('BR', 'Brown', '#A52A2A'),
('MR', 'Maroon', '#800000')
ON CONFLICT (color_code) DO NOTHING;

-- Insert Sizes
INSERT INTO sizes (size_code, name, sort_order) VALUES
('XS', 'Extra Small', 1),
('S', 'Small', 2),
('M', 'Medium', 3),
('L', 'Large', 4),
('XL', 'Extra Large', 5),
('XX', 'XXL', 6),
('FR', 'Free Size', 7),
('3X', '3XL', 8),
('4X', '4XL', 9)
ON CONFLICT (size_code) DO NOTHING;

-- Insert Vendors
INSERT INTO vendors (vendor_code, name, address, gstin, mobile, whatsapp, active) VALUES
('KR', 'Krishna Textiles', 'Mumbai, Maharashtra', '27AABCK1234F1Z5', '9876543210', '9876543210', true),
('SH', 'Sharma Fashion House', 'Delhi, NCR', '07AACCS1234F1Z8', '9876543211', '9876543211', true),
('MK', 'Meena Kreations', 'Jaipur, Rajasthan', '08AABCM1234F1Z9', '9876543212', '9876543212', true),
('RJ', 'Raj Fabrics', 'Surat, Gujarat', '24AABCR1234F1Z1', '9876543213', '9876543213', true),
('VK', 'Vijay Kurtis & More', 'Ahmedabad, Gujarat', '24AABCV1234F1Z2', '9876543214', '9876543214', true)
ON CONFLICT (vendor_code) DO NOTHING;

-- Insert Floors
INSERT INTO floors (floor_code, name, description, active) VALUES
('GF', 'Ground Floor', 'Main billing and display area', true),
('FF', 'First Floor', 'Premium collection display', true),
('SF', 'Second Floor', 'Budget and bulk collection', true),
('WH', 'Warehouse', 'Storage and stock area', true)
ON CONFLICT (floor_code) DO NOTHING;

-- Insert sample discount schemes
INSERT INTO discount_master (discount_code, discount_type, value, start_date, end_date, active_flag, description) VALUES
('FLAT500', 'Flat', 500, '2024-01-01', '2024-12-31', true, 'Flat Rs. 500 off'),
('PERC10', 'Percentage', 10, '2024-01-01', '2024-12-31', true, '10% discount'),
('PERC20', 'Percentage', 20, '2024-01-01', '2024-12-31', true, '20% discount'),
('FESTIVE', 'Percentage', 30, '2024-01-01', '2024-12-31', false, 'Festival special 30% off')
ON CONFLICT (discount_code) DO NOTHING;
