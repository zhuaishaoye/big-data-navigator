---
title: PostgreSQL实践案例
tags:
  - PostgreSQL
  - 实践案例
  - 项目
  - 电商系统
  - 数据分析
  - 性能优化
  - 最佳实践
difficulty: 高级
duration: 60分钟
description: 通过完整的实践案例，综合运用PostgreSQL的各种特性，从需求分析到系统设计、开发、优化的全流程实战。
knowledge_type: case
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据分析师
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# 🎯 PostgreSQL实践案例

## 📚 学习目标

通过本章节的学习，你将能够：
- **设计完整的PostgreSQL数据库系统**解决实际业务问题
- **综合运用各种PostgreSQL特性**构建高性能应用
- **练习数据库设计与开发流程**覆盖需求、建模、业务函数和优化示例，不包含部署交付
- **学会性能优化和监控**的实战技巧
- **理解企业级应用**的最佳实践

> [!tip] 💡 学习建议
> 这是一个综合性的实战案例，**建议跟着代码一起操作**。就像学习烹饪一样，只看菜谱是不够的，必须亲自下厨才能掌握技巧。**不要害怕出错**，每个错误都是学习的机会。在实际工作中，这样的综合项目经验会非常宝贵。

## 🛍️ 案例一：电商系统数据库设计

我们将设计一个用于综合练习的电商数据库示例，包含用户管理、商品管理、订单处理、库存管理等核心模块，不代表完整生产系统。

### 1. 需求分析和数据库设计

```sql
-- 在使用LTREE类型建表前启用扩展
CREATE EXTENSION IF NOT EXISTS ltree;

-- 1. 用户管理模块
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    birth_date DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 用户地址管理
CREATE TABLE user_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    address_type VARCHAR(20) DEFAULT 'shipping' CHECK (address_type IN ('billing', 'shipping')),
    recipient_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    country VARCHAR(50) DEFAULT 'China',
    province VARCHAR(50) NOT NULL,
    city VARCHAR(50) NOT NULL,
    district VARCHAR(50),
    address_line TEXT NOT NULL,
    postal_code VARCHAR(10),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 商品分类
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id),
    level INTEGER DEFAULT 1,
    path LTREE,  -- 使用ltree扩展支持层级结构
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 商品管理
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    short_description TEXT,
    sku VARCHAR(100) UNIQUE NOT NULL,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    cost_price DECIMAL(10,2) CHECK (cost_price >= 0),
    weight DECIMAL(8,3),
    dimensions JSONB,  -- 存储长宽高信息
    brand VARCHAR(100),
    model VARCHAR(100),
    specifications JSONB,  -- 存储产品规格
    images JSONB,  -- 存储图片URLs
    tags TEXT[],  -- 标签数组
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    featured BOOLEAN DEFAULT FALSE,
    search_vector TSVECTOR,  -- 全文搜索
    rating_average DECIMAL(3,2) DEFAULT 0.0,
    rating_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. 库存管理
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    warehouse_location VARCHAR(100) DEFAULT 'main',
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0),
    reorder_level INTEGER DEFAULT 10,
    max_stock_level INTEGER,
    last_restock_date TIMESTAMP,
    
    -- 确保预留数量不超过总数量
    CHECK (reserved_quantity <= quantity),
    
    -- 唯一约束
    UNIQUE(product_id, warehouse_location)
);

-- 6. 订单管理
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    
    -- 金额信息
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    shipping_fee DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- 支付信息
    payment_status VARCHAR(20) DEFAULT 'pending' 
        CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method VARCHAR(50),
    payment_transaction_id VARCHAR(100),
    
    -- 配送信息
    shipping_address JSONB NOT NULL,
    billing_address JSONB,
    shipping_method VARCHAR(50),
    tracking_number VARCHAR(100),
    
    -- 时间戳
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    
    -- 其他信息
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. 订单详情
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name VARCHAR(200) NOT NULL,  -- 快照数据
    product_sku VARCHAR(100) NOT NULL,   -- 快照数据
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    subtotal DECIMAL(10,2) NOT NULL,
    
    -- 确保小计正确
    CHECK (subtotal = unit_price * quantity)
);

-- 8. 购物车
CREATE TABLE shopping_cart (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 唯一约束：用户+商品
    UNIQUE(user_id, product_id)
);

-- 9. 商品评价
CREATE TABLE product_reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(200),
    content TEXT,
    images JSONB,
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'published' 
        CHECK (status IN ('pending', 'published', 'hidden')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 用户只能对同一产品评价一次
    UNIQUE(product_id, user_id)
);

-- 10. 促销和优惠券
CREATE TABLE coupons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('fixed_amount', 'percentage')),
    value DECIMAL(10,2) NOT NULL,
    minimum_amount DECIMAL(10,2) DEFAULT 0,
    maximum_discount DECIMAL(10,2),
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 确保使用次数不超过限制
    CHECK (used_count <= COALESCE(usage_limit, used_count + 1))
);
```

### 2. 创建索引和扩展

```sql
-- 安装必要的扩展
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 用户相关索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_registration_date ON users(registration_date);

-- 地址索引
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_user_addresses_type ON user_addresses(address_type);

-- 分类索引
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_path ON categories USING GIST(path);
CREATE INDEX idx_categories_slug ON categories(slug);

-- 商品索引
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_featured ON products(featured) WHERE featured = TRUE;
CREATE INDEX idx_products_rating ON products(rating_average);
CREATE INDEX idx_products_search ON products USING GIN(search_vector);
CREATE INDEX idx_products_tags ON products USING GIN(tags);
CREATE INDEX idx_products_specifications ON products USING GIN(specifications);

-- 三元组索引用于模糊搜索
CREATE INDEX idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);

-- 库存索引
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_location);
CREATE INDEX idx_inventory_low_stock ON inventory(quantity) WHERE quantity <= reorder_level;

-- 订单索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);

-- 订单项索引
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- 购物车索引
CREATE INDEX idx_shopping_cart_user_id ON shopping_cart(user_id);
CREATE INDEX idx_shopping_cart_added_at ON shopping_cart(added_at);

-- 评价索引
CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_user_id ON product_reviews(user_id);
CREATE INDEX idx_product_reviews_rating ON product_reviews(rating);
CREATE INDEX idx_product_reviews_created_at ON product_reviews(created_at);

-- 优惠券索引
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active_dates ON coupons(start_date, end_date) WHERE is_active = TRUE;
```

### 3. 创建触发器和函数

```sql
-- 1. 更新updated_at字段的通用函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表创建触发器
CREATE TRIGGER trigger_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_shopping_cart_updated_at 
    BEFORE UPDATE ON shopping_cart 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. 自动生成订单号
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := 'ORD' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || 
                           CASE WHEN LENGTH(NEW.id::TEXT) < 6 THEN LPAD(NEW.id::TEXT, 6, '0') ELSE NEW.id::TEXT END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- 3. 自动更新商品搜索向量
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', 
        COALESCE(NEW.name, '') || ' ' || 
        COALESCE(NEW.description, '') || ' ' || 
        COALESCE(NEW.brand, '') || ' ' ||
        COALESCE(array_to_string(NEW.tags, ' '), '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_search
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_product_search_vector();

-- 4. 自动更新商品评分
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
DECLARE
    avg_rating DECIMAL(3,2);
    total_reviews INTEGER;
BEGIN
    -- 计算新的平均评分和评价数量
    SELECT 
        COALESCE(AVG(rating), 0.0),
        COUNT(*)
    INTO avg_rating, total_reviews
    FROM product_reviews 
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
      AND status = 'published';
    
    -- 更新商品表
    UPDATE products 
    SET 
        rating_average = avg_rating,
        rating_count = total_reviews
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_rating
    AFTER INSERT OR UPDATE OR DELETE ON product_reviews
    FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- 5. 库存管理触发器
CREATE OR REPLACE FUNCTION manage_inventory()
RETURNS TRIGGER AS $$
DECLARE
    available_qty INTEGER;
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- 检查库存是否足够
        SELECT (quantity - reserved_quantity) INTO available_qty
        FROM inventory 
        WHERE product_id = NEW.product_id;
        
        IF available_qty < 0 THEN
            RAISE EXCEPTION 'Insufficient inventory for product %', NEW.product_id;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_inventory
    AFTER INSERT OR UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION manage_inventory();
```

### 4. 核心业务函数

```sql
-- 1. 添加商品到购物车
CREATE OR REPLACE FUNCTION add_to_cart(
    p_user_id INTEGER,
    p_product_id INTEGER,
    p_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    available_qty INTEGER;
    current_cart_qty INTEGER;
BEGIN
    -- 检查商品是否存在且有效
    IF NOT EXISTS (
        SELECT 1 FROM products 
        WHERE id = p_product_id AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Product not found or inactive';
    END IF;
    
    -- 检查库存
    SELECT (quantity - reserved_quantity) INTO available_qty
    FROM inventory 
    WHERE product_id = p_product_id;
    
    IF available_qty IS NULL THEN
        RAISE EXCEPTION 'Product not in inventory';
    END IF;
    
    -- 获取购物车中当前数量
    SELECT COALESCE(quantity, 0) INTO current_cart_qty
    FROM shopping_cart 
    WHERE user_id = p_user_id AND product_id = p_product_id;
    
    -- 无购物车记录时将当前数量设为0；本示例仍按单仓库存处理
    current_cart_qty := COALESCE(current_cart_qty, 0);

    -- 检查总数量是否超过库存
    IF (current_cart_qty + p_quantity) > available_qty THEN
        RAISE EXCEPTION 'Insufficient inventory. Available: %, Requested: %', 
                       available_qty, (current_cart_qty + p_quantity);
    END IF;
    
    -- 插入或更新购物车
    INSERT INTO shopping_cart (user_id, product_id, quantity)
    VALUES (p_user_id, p_product_id, p_quantity)
    ON CONFLICT (user_id, product_id)
    DO UPDATE SET 
        quantity = shopping_cart.quantity + p_quantity,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 2. 创建订单
CREATE OR REPLACE FUNCTION create_order(
    p_user_id INTEGER,
    p_shipping_address JSONB,
    p_payment_method VARCHAR(50) DEFAULT 'credit_card'
) RETURNS INTEGER AS $$
DECLARE
    order_id INTEGER;
    cart_item RECORD;
    order_total DECIMAL(10,2) := 0;
    order_subtotal DECIMAL(10,2) := 0;
    shipping_fee DECIMAL(10,2) := 10.00;  -- 固定运费
    tax_rate DECIMAL(4,4) := 0.0800;      -- 8%税率
    tax_amount DECIMAL(10,2);
BEGIN
    -- 检查购物车是否为空
    IF NOT EXISTS (
        SELECT 1 FROM shopping_cart WHERE user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Shopping cart is empty';
    END IF;
    
    -- 开始事务
    BEGIN
        -- 创建订单记录
        INSERT INTO orders (
            user_id, subtotal, tax_amount, shipping_fee, total_amount,
            shipping_address, payment_method
        ) VALUES (
            p_user_id, 0, 0, shipping_fee, 0,  -- 临时值，稍后更新
            p_shipping_address, p_payment_method
        ) RETURNING id INTO order_id;
        
        -- 处理购物车中的每个商品
        FOR cart_item IN 
            SELECT c.product_id, c.quantity, p.price, p.name, p.sku
            FROM shopping_cart c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = p_user_id AND p.status = 'active'
        LOOP
            -- 检查并预留库存
            UPDATE inventory 
            SET reserved_quantity = reserved_quantity + cart_item.quantity
            WHERE product_id = cart_item.product_id
              AND (quantity - reserved_quantity) >= cart_item.quantity;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Insufficient inventory for product: %', cart_item.name;
            END IF;
            
            -- 创建订单项
            INSERT INTO order_items (
                order_id, product_id, product_name, product_sku,
                unit_price, quantity, subtotal
            ) VALUES (
                order_id, cart_item.product_id, cart_item.name, cart_item.sku,
                cart_item.price, cart_item.quantity, 
                cart_item.price * cart_item.quantity
            );
            
            -- 累计订单金额
            order_subtotal := order_subtotal + (cart_item.price * cart_item.quantity);
        END LOOP;
        
        -- 计算税费和总金额
        tax_amount := order_subtotal * tax_rate;
        order_total := order_subtotal + tax_amount + shipping_fee;
        
        -- 更新订单总金额
        UPDATE orders 
        SET 
            subtotal = order_subtotal,
            tax_amount = tax_amount,
            total_amount = order_total
        WHERE id = order_id;
        
        -- 清空购物车
        DELETE FROM shopping_cart WHERE user_id = p_user_id;
        
        RETURN order_id;
        
    EXCEPTION WHEN OTHERS THEN
        -- 出错时回滚事务
        RAISE;
    END;
END;
$$ LANGUAGE plpgsql;

-- 3. 确认订单并扣减库存
CREATE OR REPLACE FUNCTION confirm_order(p_order_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    order_item RECORD;
BEGIN
    -- 检查订单状态
    IF NOT EXISTS (
        SELECT 1 FROM orders 
        WHERE id = p_order_id AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'Order not found or already processed';
    END IF;
    
    -- 处理订单中的每个商品
    FOR order_item IN 
        SELECT product_id, quantity
        FROM order_items
        WHERE order_id = p_order_id
    LOOP
        -- 从库存中扣减数量
        UPDATE inventory 
        SET 
            quantity = quantity - order_item.quantity,
            reserved_quantity = reserved_quantity - order_item.quantity
        WHERE product_id = order_item.product_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Inventory record not found for product: %', order_item.product_id;
        END IF;
    END LOOP;
    
    -- 更新订单状态
    UPDATE orders 
    SET 
        status = 'confirmed',
        confirmed_at = CURRENT_TIMESTAMP,
        payment_status = 'paid'
    WHERE id = p_order_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 4. 取消订单并释放库存
CREATE OR REPLACE FUNCTION cancel_order(p_order_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    order_item RECORD;
    order_status VARCHAR(20);
BEGIN
    -- 获取订单状态
    SELECT status INTO order_status
    FROM orders 
    WHERE id = p_order_id;
    
    IF order_status IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    IF order_status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'Cannot cancel order with status: %', order_status;
    END IF;
    
    -- 处理订单中的每个商品
    FOR order_item IN 
        SELECT product_id, quantity
        FROM order_items
        WHERE order_id = p_order_id
    LOOP
        IF order_status = 'pending' THEN
            -- 释放预留库存
            UPDATE inventory 
            SET reserved_quantity = reserved_quantity - order_item.quantity
            WHERE product_id = order_item.product_id;
        ELSE
            -- 恢复库存数量
            UPDATE inventory 
            SET quantity = quantity + order_item.quantity
            WHERE product_id = order_item.product_id;
        END IF;
    END LOOP;
    
    -- 更新订单状态
    UPDATE orders 
    SET 
        status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_order_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

### 5. 插入测试数据

```sql
-- 1. 插入测试用户
INSERT INTO users (username, email, password_hash, full_name, phone, birth_date, gender) VALUES
('john_doe', 'john@example.com', 'hashed_password_123', '约翰·多伊', '13800138001', '1990-05-15', 'male'),
('jane_smith', 'jane@example.com', 'hashed_password_456', '简·史密斯', '13800138002', '1992-08-20', 'female'),
('alice_wang', 'alice@example.com', 'hashed_password_789', '王小丽', '13800138003', '1988-12-10', 'female'),
('bob_chen', 'bob@example.com', 'hashed_password_abc', '陈小明', '13800138004', '1985-03-25', 'male'),
('sarah_liu', 'sarah@example.com', 'hashed_password_def', '刘小红', '13800138005', '1993-07-18', 'female');

-- 2. 插入用户地址
INSERT INTO user_addresses (user_id, recipient_name, phone, province, city, address_line, is_default) VALUES
(1, '约翰·多伊', '13800138001', '北京市', '朝阳区', '建国门外大街1号', TRUE),
(2, '简·史密斯', '13800138002', '上海市', '浦东新区', '陆家嘴环路1000号', TRUE),
(3, '王小丽', '13800138003', '广东省', '深圳市', '南山区科技园南区', TRUE),
(4, '陈小明', '13800138004', '浙江省', '杭州市', '西湖区文三路', TRUE),
(5, '刘小红', '13800138005', '江苏省', '南京市', '玄武区中山路', TRUE);

-- 3. 插入商品分类
INSERT INTO categories (name, slug, description, parent_id, level, path) VALUES
('电子产品', 'electronics', '各类电子产品', NULL, 1, 'electronics'),
('服装鞋帽', 'clothing', '服装鞋帽用品', NULL, 1, 'clothing'),
('家居用品', 'home', '家居生活用品', NULL, 1, 'home'),
('图书音像', 'books', '图书音像制品', NULL, 1, 'books'),
('手机数码', 'mobile', '手机及数码产品', 1, 2, 'electronics.mobile'),
('电脑办公', 'computer', '电脑及办公用品', 1, 2, 'electronics.computer'),
('男装', 'mens-clothing', '男士服装', 2, 2, 'clothing.mens'),
('女装', 'womens-clothing', '女士服装', 2, 2, 'clothing.womens');

-- 4. 插入商品
INSERT INTO products (category_id, name, slug, description, sku, price, cost_price, brand, specifications, tags) VALUES
(5, 'iPhone 15 Pro', 'iphone-15-pro', '苹果最新旗舰手机，支持5G网络', 'IP15P-128-BLK', 7999.00, 6000.00, 'Apple', 
 '{"storage": "128GB", "color": "黑色", "screen": "6.1英寸", "camera": "4800万像素"}', 
 ARRAY['smartphone', 'apple', '5g', 'flagship']),
 
(5, 'Samsung Galaxy S24', 'samsung-galaxy-s24', '三星旗舰安卓手机', 'SGS24-256-WHT', 6999.00, 5200.00, 'Samsung',
 '{"storage": "256GB", "color": "白色", "screen": "6.2英寸", "camera": "5000万像素"}',
 ARRAY['smartphone', 'samsung', 'android', '5g']),

(6, 'MacBook Air M3', 'macbook-air-m3', '苹果轻薄笔记本电脑', 'MBA-M3-512-SLV', 9999.00, 7500.00, 'Apple',
 '{"processor": "M3芯片", "memory": "16GB", "storage": "512GB SSD", "color": "银色"}',
 ARRAY['laptop', 'apple', 'ultrabook', 'm3']),

(6, 'Dell XPS 13', 'dell-xps-13', '戴尔商务超极本', 'DXS13-1TB-BLK', 8999.00, 6800.00, 'Dell',
 '{"processor": "Intel i7", "memory": "16GB", "storage": "1TB SSD", "color": "黑色"}',
 ARRAY['laptop', 'dell', 'business', 'intel']),

(7, '优衣库基础T恤', 'uniqlo-basic-tee', '100%纯棉基础款T恤', 'UQ-TEE-M-WHT', 59.00, 30.00, 'UNIQLO',
 '{"material": "纯棉", "size": "M", "color": "白色", "fit": "标准版型"}',
 ARRAY['tshirt', 'cotton', 'basic', 'uniqlo']),

(8, 'ZARA连衣裙', 'zara-dress', '时尚修身连衣裙', 'ZR-DRS-S-BLU', 299.00, 150.00, 'ZARA',
 '{"material": "聚酯纤维", "size": "S", "color": "蓝色", "style": "修身"}',
 ARRAY['dress', 'fashion', 'zara', 'elegant']);

-- 5. 插入库存信息
INSERT INTO inventory (product_id, warehouse_location, quantity, reorder_level) VALUES
(1, 'main', 50, 10),
(2, 'main', 30, 5),
(3, 'main', 25, 5),
(4, 'main', 40, 8),
(5, 'main', 100, 20),
(6, 'main', 80, 15);

-- 6. 插入一些测试的购物车数据
SELECT add_to_cart(1, 1, 1);  -- 用户1添加iPhone到购物车
SELECT add_to_cart(1, 5, 2);  -- 用户1添加T恤到购物车
SELECT add_to_cart(2, 2, 1);  -- 用户2添加Samsung手机到购物车
SELECT add_to_cart(3, 3, 1);  -- 用户3添加MacBook到购物车

-- 7. 创建一些测试订单
SELECT create_order(1, '{"recipient": "约翰·多伊", "phone": "13800138001", "address": "北京市朝阳区建国门外大街1号"}');
SELECT create_order(2, '{"recipient": "简·史密斯", "phone": "13800138002", "address": "上海市浦东新区陆家嘴环路1000号"}');

-- 8. 确认订单
SELECT confirm_order(1);
SELECT confirm_order(2);

-- 9. 插入商品评价
INSERT INTO product_reviews (product_id, user_id, order_id, rating, title, content, is_verified_purchase) VALUES
(1, 1, 1, 5, '非常满意', '手机性能很好，摄像头清晰，电池续航给力！', TRUE),
(2, 2, 2, 4, '整体不错', '手机很好用，就是价格稍微有点高，但是值得购买。', TRUE),
(5, 1, 1, 5, '基础款也很好', 'T恤质量很好，纯棉材质很舒服，性价比很高。', TRUE);

-- 10. 插入优惠券
INSERT INTO coupons (code, name, description, type, value, minimum_amount, usage_limit, start_date, end_date) VALUES
('WELCOME10', '新用户优惠券', '新用户专享10元优惠', 'fixed_amount', 10.00, 100.00, 1000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days'),
('SAVE50', '满500减50', '满500元减50元', 'fixed_amount', 50.00, 500.00, 500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '15 days'),
('DISCOUNT20', '8折优惠', '全场8折优惠', 'percentage', 20.00, 200.00, 200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days');
```

## 📊 案例二：数据分析系统

现在我们来创建一个数据分析系统，用于分析电商数据。

### 1. 创建分析视图

```sql
-- 1. 销售概览视图
CREATE VIEW v_sales_overview AS
SELECT 
    DATE_TRUNC('day', o.order_date) as sale_date,
    COUNT(DISTINCT o.id) as order_count,
    COUNT(DISTINCT o.user_id) as customer_count,
    SUM(o.total_amount) as total_revenue,
    AVG(o.total_amount) as avg_order_value,
    SUM(oi.quantity) as total_items_sold
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.status NOT IN ('cancelled', 'refunded')
GROUP BY DATE_TRUNC('day', o.order_date);

-- 2. 产品销售分析视图
CREATE VIEW v_product_sales AS
SELECT 
    p.id,
    p.name,
    p.category_id,
    c.name as category_name,
    p.brand,
    p.price,
    COALESCE(SUM(oi.quantity), 0) as total_sold,
    COALESCE(SUM(oi.subtotal), 0) as total_revenue,
    COALESCE(AVG(oi.unit_price), p.price) as avg_selling_price,
    p.rating_average,
    p.rating_count,
    p.view_count
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id AND o.status NOT IN ('cancelled', 'refunded')
LEFT JOIN categories c ON p.category_id = c.id
GROUP BY p.id, p.name, p.category_id, c.name, p.brand, p.price, p.rating_average, p.rating_count, p.view_count;

-- 3. 用户行为分析视图
CREATE VIEW v_user_behavior AS
SELECT 
    u.id,
    u.username,
    u.registration_date,
    EXTRACT(DAYS FROM (CURRENT_DATE - u.registration_date)) as days_since_registration,
    COUNT(DISTINCT o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_spent,
    COALESCE(AVG(o.total_amount), 0) as avg_order_value,
    MAX(o.order_date) as last_order_date,
    EXTRACT(DAYS FROM (CURRENT_DATE - MAX(o.order_date))) as days_since_last_order,
    COUNT(DISTINCT pr.id) as review_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id AND o.status NOT IN ('cancelled', 'refunded')
LEFT JOIN product_reviews pr ON u.id = pr.user_id
GROUP BY u.id, u.username, u.registration_date;

-- 4. 库存预警视图
CREATE VIEW v_inventory_alerts AS
SELECT 
    p.id,
    p.name,
    p.sku,
    i.quantity as current_stock,
    i.reserved_quantity,
    (i.quantity - i.reserved_quantity) as available_stock,
    i.reorder_level,
    CASE 
        WHEN (i.quantity - i.reserved_quantity) <= 0 THEN 'OUT_OF_STOCK'
        WHEN (i.quantity - i.reserved_quantity) <= i.reorder_level THEN 'LOW_STOCK'
        ELSE 'NORMAL'
    END as stock_status,
    COALESCE(
        (SELECT SUM(oi.quantity) 
         FROM order_items oi 
         JOIN orders o ON oi.order_id = o.id 
         WHERE oi.product_id = p.id 
           AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'
           AND o.status NOT IN ('cancelled', 'refunded')
        ), 0
    ) as sales_last_30_days
FROM products p
JOIN inventory i ON p.id = i.product_id
WHERE p.status = 'active';
```

### 2. 创建分析函数

```sql
-- 1. 计算用户生命周期价值（CLV）
CREATE OR REPLACE FUNCTION calculate_customer_ltv(p_user_id INTEGER)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    avg_order_value DECIMAL(10,2);
    order_frequency DECIMAL(10,4);
    customer_lifespan INTEGER;
    ltv DECIMAL(10,2);
BEGIN
    -- 计算平均订单价值
    SELECT COALESCE(AVG(total_amount), 0) INTO avg_order_value
    FROM orders 
    WHERE user_id = p_user_id AND status NOT IN ('cancelled', 'refunded');
    
    -- 计算订单频率（订单数/注册天数）
    SELECT 
        CASE 
            WHEN EXTRACT(DAYS FROM (CURRENT_DATE - registration_date)) > 0 THEN
                COUNT(o.id)::DECIMAL / EXTRACT(DAYS FROM (CURRENT_DATE - u.registration_date))
            ELSE 0
        END
    INTO order_frequency
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id AND o.status NOT IN ('cancelled', 'refunded')
    WHERE u.id = p_user_id
    GROUP BY u.registration_date;
    
    -- 假设客户生命周期为365天
    customer_lifespan := 365;
    
    -- 计算LTV
    ltv := avg_order_value * order_frequency * customer_lifespan;
    
    RETURN ltv;
END;
$$ LANGUAGE plpgsql;

-- 2. 商品推荐示例（基于已购类别和品牌的规则匹配，使用固定示例权重，不是协同过滤）
CREATE OR REPLACE FUNCTION recommend_products(p_user_id INTEGER, p_limit INTEGER DEFAULT 5)
RETURNS TABLE(
    product_id INTEGER,
    product_name VARCHAR(200),
    similarity_score DECIMAL(5,4),
    recommendation_reason TEXT
) AS $$
DECLARE
    user_categories INTEGER[];
    user_brands TEXT[];
BEGIN
    -- 获取用户购买的产品类别
    SELECT ARRAY_AGG(DISTINCT p.category_id) INTO user_categories
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.user_id = p_user_id AND o.status NOT IN ('cancelled', 'refunded');
    
    -- 获取用户购买的品牌
    SELECT ARRAY_AGG(DISTINCT p.brand) INTO user_brands
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.user_id = p_user_id AND o.status NOT IN ('cancelled', 'refunded')
      AND p.brand IS NOT NULL;
    
    -- 返回推荐商品
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        CASE 
            WHEN p.category_id = ANY(user_categories) AND p.brand = ANY(user_brands) THEN 0.9
            WHEN p.category_id = ANY(user_categories) THEN 0.7
            WHEN p.brand = ANY(user_brands) THEN 0.6
            ELSE 0.3
        END as similarity_score,
        CASE 
            WHEN p.category_id = ANY(user_categories) AND p.brand = ANY(user_brands) THEN '基于您的购买历史：相同类别和品牌'
            WHEN p.category_id = ANY(user_categories) THEN '基于您的购买历史：相同类别'
            WHEN p.brand = ANY(user_brands) THEN '基于您的购买历史：相同品牌'
            ELSE '热门推荐'
        END as recommendation_reason
    FROM products p
    WHERE p.status = 'active'
      AND p.id NOT IN (
          -- 排除已购买的商品
          SELECT DISTINCT oi.product_id
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE o.user_id = p_user_id AND o.status NOT IN ('cancelled', 'refunded')
      )
    ORDER BY similarity_score DESC, p.rating_average DESC, p.view_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 3. 销售趋势分析
CREATE OR REPLACE FUNCTION analyze_sales_trend(
    p_start_date DATE,
    p_end_date DATE,
    p_granularity TEXT DEFAULT 'day'  -- 'day', 'week', 'month'
) RETURNS TABLE(
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    order_count BIGINT,
    total_revenue DECIMAL(10,2),
    avg_order_value DECIMAL(10,2),
    growth_rate DECIMAL(5,2)
) AS $$
DECLARE
    date_trunc_format TEXT;
BEGIN
    -- 设置日期截断格式
    CASE p_granularity
        WHEN 'week' THEN date_trunc_format := 'week';
        WHEN 'month' THEN date_trunc_format := 'month';
        ELSE date_trunc_format := 'day';
    END CASE;
    
    RETURN QUERY
    WITH sales_by_period AS (
        SELECT 
            DATE_TRUNC(date_trunc_format, o.order_date) as period_start,
            COUNT(o.id) as order_count,
            SUM(o.total_amount) as total_revenue,
            AVG(o.total_amount) as avg_order_value
        FROM orders o
        WHERE o.order_date >= p_start_date
          AND o.order_date < p_end_date + INTERVAL '1 day'
          AND o.status NOT IN ('cancelled', 'refunded')
        GROUP BY DATE_TRUNC(date_trunc_format, o.order_date)
    ),
    sales_with_growth AS (
        SELECT 
            sbp.*,
            CASE p_granularity
                WHEN 'week' THEN sbp.period_start + INTERVAL '1 week' - INTERVAL '1 day'
                WHEN 'month' THEN sbp.period_start + INTERVAL '1 month' - INTERVAL '1 day'
                ELSE sbp.period_start + INTERVAL '1 day' - INTERVAL '1 second'
            END as period_end,
            LAG(sbp.total_revenue) OVER (ORDER BY sbp.period_start) as prev_revenue
        FROM sales_by_period sbp
    )
    SELECT 
        swg.period_start,
        swg.period_end,
        swg.order_count,
        swg.total_revenue,
        swg.avg_order_value,
        CASE 
            WHEN swg.prev_revenue > 0 THEN 
                ROUND(((swg.total_revenue - swg.prev_revenue) / swg.prev_revenue * 100), 2)
            ELSE NULL
        END as growth_rate
    FROM sales_with_growth swg
    ORDER BY swg.period_start;
END;
$$ LANGUAGE plpgsql;

-- 4. ABC分析（商品重要性分析）
CREATE OR REPLACE FUNCTION abc_analysis()
RETURNS TABLE(
    product_id INTEGER,
    product_name VARCHAR(200),
    total_revenue DECIMAL(10,2),
    revenue_percentage DECIMAL(5,2),
    cumulative_percentage DECIMAL(5,2),
    abc_category CHAR(1)
) AS $$
BEGIN
    RETURN QUERY
    WITH product_revenue AS (
        SELECT 
            p.id,
            p.name,
            COALESCE(SUM(oi.subtotal), 0) as total_revenue
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id AND o.status NOT IN ('cancelled', 'refunded')
        GROUP BY p.id, p.name
    ),
    revenue_analysis AS (
        SELECT 
            pr.*,
            (pr.total_revenue / SUM(pr.total_revenue) OVER () * 100) as revenue_percentage,
            SUM(pr.total_revenue / SUM(pr.total_revenue) OVER () * 100) OVER (ORDER BY pr.total_revenue DESC) as cumulative_percentage
        FROM product_revenue pr
        WHERE pr.total_revenue > 0
    )
    SELECT 
        ra.id,
        ra.name,
        ra.total_revenue,
        ROUND(ra.revenue_percentage, 2),
        ROUND(ra.cumulative_percentage, 2),
        CASE 
            WHEN ra.cumulative_percentage <= 80 THEN 'A'
            WHEN ra.cumulative_percentage <= 95 THEN 'B'
            ELSE 'C'
        END as abc_category
    FROM revenue_analysis ra
    ORDER BY ra.total_revenue DESC;
END;
$$ LANGUAGE plpgsql;
```

### 3. 创建报表和仪表板

```sql
-- 1. 每日销售报表
CREATE OR REPLACE VIEW v_daily_sales_report AS
SELECT 
    DATE(o.order_date) as sale_date,
    COUNT(DISTINCT o.id) as order_count,
    COUNT(DISTINCT o.user_id) as unique_customers,
    SUM(o.total_amount) as total_revenue,
    AVG(o.total_amount) as avg_order_value,
    SUM(oi.quantity) as total_items,
    COUNT(DISTINCT oi.product_id) as unique_products,
    
    -- 分类销售
    SUM(CASE WHEN c.name = '电子产品' THEN oi.subtotal ELSE 0 END) as electronics_revenue,
    SUM(CASE WHEN c.name = '服装鞋帽' THEN oi.subtotal ELSE 0 END) as clothing_revenue,
    SUM(CASE WHEN c.name = '家居用品' THEN oi.subtotal ELSE 0 END) as home_revenue,
    
    -- 退款统计
    COUNT(CASE WHEN o.status = 'refunded' THEN 1 END) as refund_count,
    SUM(CASE WHEN o.status = 'refunded' THEN o.total_amount ELSE 0 END) as refund_amount
    
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
JOIN categories c ON p.category_id = c.id
GROUP BY DATE(o.order_date)
ORDER BY sale_date DESC;

-- 2. 产品性能报表
CREATE OR REPLACE VIEW v_product_performance AS
SELECT 
    p.id,
    p.name,
    p.sku,
    c.name as category,
    p.brand,
    p.price,
    i.quantity as current_stock,
    
    -- 销售数据
    COALESCE(sales.total_sold, 0) as units_sold,
    COALESCE(sales.total_revenue, 0) as revenue,
    COALESCE(sales.avg_selling_price, 0) as avg_selling_price,
    
    -- 利润分析
    CASE 
        WHEN p.cost_price IS NOT NULL AND sales.total_sold > 0 THEN
            (sales.avg_selling_price - p.cost_price) * sales.total_sold
        ELSE 0
    END as total_profit,
    
    -- 评价数据
    p.rating_average,
    p.rating_count,
    
    -- 库存周转
    CASE 
        WHEN i.quantity > 0 AND sales.total_sold > 0 THEN
            ROUND(sales.total_sold::DECIMAL / i.quantity, 2)
        ELSE 0
    END as inventory_turnover,
    
    -- 缺货天数（示例）
    0 as days_out_of_stock
    
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN inventory i ON p.id = i.product_id
LEFT JOIN (
    SELECT 
        oi.product_id,
        SUM(oi.quantity) as total_sold,
        SUM(oi.subtotal) as total_revenue,
        AVG(oi.unit_price) as avg_selling_price
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status NOT IN ('cancelled', 'refunded')
      AND o.order_date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY oi.product_id
) sales ON p.id = sales.product_id
WHERE p.status = 'active';

-- 3. 客户细分报表
CREATE OR REPLACE VIEW v_customer_segments AS
WITH customer_metrics AS (
    SELECT 
        u.id,
        u.username,
        u.registration_date,
        EXTRACT(DAYS FROM (CURRENT_DATE - u.registration_date)) as customer_age_days,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as total_spent,
        COALESCE(AVG(o.total_amount), 0) as avg_order_value,
        MAX(o.order_date) as last_order_date,
        COALESCE(EXTRACT(DAYS FROM (CURRENT_DATE - MAX(o.order_date))), 999) as days_since_last_order
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id AND o.status NOT IN ('cancelled', 'refunded')
    GROUP BY u.id, u.username, u.registration_date
)
SELECT 
    cm.*,
    calculate_customer_ltv(cm.id) as estimated_ltv,
    
    -- RFM分析
    CASE 
        WHEN cm.days_since_last_order <= 30 THEN 'High'
        WHEN cm.days_since_last_order <= 90 THEN 'Medium'
        ELSE 'Low'
    END as recency_score,
    
    CASE 
        WHEN cm.order_count >= 10 THEN 'High'
        WHEN cm.order_count >= 5 THEN 'Medium'
        ELSE 'Low'
    END as frequency_score,
    
    CASE 
        WHEN cm.total_spent >= 10000 THEN 'High'
        WHEN cm.total_spent >= 5000 THEN 'Medium'
        ELSE 'Low'
    END as monetary_score,
    
    -- 客户分类
    CASE 
        WHEN cm.days_since_last_order <= 30 AND cm.order_count >= 5 AND cm.total_spent >= 5000 THEN 'VIP客户'
        WHEN cm.days_since_last_order <= 60 AND cm.order_count >= 3 AND cm.total_spent >= 2000 THEN '优质客户'
        WHEN cm.days_since_last_order <= 90 AND cm.order_count >= 1 THEN '普通客户'
        WHEN cm.days_since_last_order > 90 AND cm.order_count > 0 THEN '流失客户'
        ELSE '新客户'
    END as customer_segment
    
FROM customer_metrics cm;
```

### 4. 性能优化示例

```sql
-- 1. 创建汇总表（减少实时计算）
CREATE TABLE daily_sales_summary (
    summary_date DATE PRIMARY KEY,
    order_count INTEGER,
    total_revenue DECIMAL(10,2),
    unique_customers INTEGER,
    avg_order_value DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建汇总数据的函数
CREATE OR REPLACE FUNCTION update_daily_summary(target_date DATE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO daily_sales_summary (
        summary_date, order_count, total_revenue, unique_customers, avg_order_value
    )
    SELECT 
        target_date,
        COUNT(DISTINCT o.id),
        COALESCE(SUM(o.total_amount), 0),
        COUNT(DISTINCT o.user_id),
        COALESCE(AVG(o.total_amount), 0)
    FROM orders o
    WHERE DATE(o.order_date) = target_date
      AND o.status NOT IN ('cancelled', 'refunded')
    ON CONFLICT (summary_date) 
    DO UPDATE SET
        order_count = EXCLUDED.order_count,
        total_revenue = EXCLUDED.total_revenue,
        unique_customers = EXCLUDED.unique_customers,
        avg_order_value = EXCLUDED.avg_order_value,
        created_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- 3. 创建分区表（用于大数据量场景）
CREATE TABLE order_history (
    id SERIAL,
    order_id INTEGER,
    user_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    unit_price DECIMAL(10,2),
    order_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (order_date);

-- 创建分区
CREATE TABLE order_history_2024_q1 PARTITION OF order_history
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
    
CREATE TABLE order_history_2024_q2 PARTITION OF order_history
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

-- 4. 创建物化视图
CREATE MATERIALIZED VIEW mv_product_sales_summary AS
SELECT 
    p.id,
    p.name,
    p.category_id,
    COUNT(DISTINCT oi.order_id) as order_count,
    SUM(oi.quantity) as total_quantity,
    SUM(oi.subtotal) as total_revenue,
    AVG(oi.unit_price) as avg_price,
    MAX(o.order_date) as last_sale_date
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id AND o.status NOT IN ('cancelled', 'refunded')
GROUP BY p.id, p.name, p.category_id;

-- 为并发刷新提供覆盖全部行的唯一索引
CREATE UNIQUE INDEX idx_mv_product_sales_id ON mv_product_sales_summary(id);

-- 创建索引
CREATE INDEX idx_mv_product_sales_category ON mv_product_sales_summary(category_id);
CREATE INDEX idx_mv_product_sales_revenue ON mv_product_sales_summary(total_revenue DESC);

-- 刷新物化视图的函数
CREATE OR REPLACE FUNCTION refresh_product_sales_summary()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_sales_summary;
END;
$$ LANGUAGE plpgsql;
```

## 🎯 性能监控和优化

### 1. 监控查询

```sql
-- 1. 查看慢查询
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE mean_time > 100  -- 平均执行时间超过100ms
ORDER BY total_time DESC
LIMIT 10;

-- 2. 查看锁等待
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;

-- 3. 表和索引大小监控
SELECT 
    t.tablename,
    pg_size_pretty(pg_total_relation_size(t.tablename::regclass)) as total_size,
    pg_size_pretty(pg_relation_size(t.tablename::regclass)) as table_size,
    pg_size_pretty(pg_total_relation_size(t.tablename::regclass) - 
                   pg_relation_size(t.tablename::regclass)) as index_size,
    ROUND(
        100.0 * (pg_total_relation_size(t.tablename::regclass) - pg_relation_size(t.tablename::regclass)) / 
        NULLIF(pg_total_relation_size(t.tablename::regclass), 0), 2
    ) as index_ratio
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY pg_total_relation_size(t.tablename::regclass) DESC;
```

### 2. 自动化维护

```sql
-- 1. 自动vacuum和analyze
CREATE OR REPLACE FUNCTION auto_maintenance()
RETURNS TEXT AS $$
DECLARE
    table_record RECORD;
    maintenance_log TEXT := '';
BEGIN
    FOR table_record IN 
        SELECT 
            schemaname, 
            tablename,
            n_dead_tup,
            n_live_tup,
            CASE 
                WHEN n_live_tup > 0 THEN n_dead_tup * 100.0 / n_live_tup 
                ELSE 0 
            END as dead_ratio
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
    LOOP
        IF table_record.dead_ratio > 20 THEN
            EXECUTE format('VACUUM ANALYZE %I.%I', table_record.schemaname, table_record.tablename);
            maintenance_log := maintenance_log || format('VACUUM ANALYZE %s.%s (dead ratio: %.2f%%);', 
                              table_record.schemaname, table_record.tablename, table_record.dead_ratio) || E'\n';
        ELSIF table_record.dead_ratio > 10 THEN
            EXECUTE format('ANALYZE %I.%I', table_record.schemaname, table_record.tablename);
            maintenance_log := maintenance_log || format('ANALYZE %s.%s (dead ratio: %.2f%%);', 
                              table_record.schemaname, table_record.tablename, table_record.dead_ratio) || E'\n';
        END IF;
    END LOOP;
    
    IF maintenance_log = '' THEN
        maintenance_log := 'No maintenance required.';
    END IF;
    
    RETURN maintenance_log;
END;
$$ LANGUAGE plpgsql;

-- 执行维护
SELECT auto_maintenance();
```

## 🎯 小结

通过这个综合实践案例，我们完成了：

1. **电商数据库设计示例**：用户管理、商品管理、订单处理、库存管理，业务与并发边界见维护说明
2. **高级数据分析功能**：销售分析、用户分析、产品推荐、ABC分析
3. **性能优化实践**：索引策略、分区表、物化视图、查询优化
4. **监控和维护示例**：性能监控查询及维护思路；自动维护函数存在执行缺陷，报警触发与通知机制尚未实现
5. **最佳实践应用**：事务管理、错误处理、数据完整性

> [!abstract] 🎓 恭喜完成PostgreSQL学习路程
> 现在你已经掌握了PostgreSQL的核心技能，从基础概念到高级特性，从理论到实践。**这只是开始，持续的实践和学习将让你成为PostgreSQL专家**。记住，最好的学习方式就是在实际项目中应用这些知识！

## 🔗 相关资源

- [[【技术与工具】/PostgreSQL/00-PostgreSQL学习路线图|PostgreSQL]]
- [[【技术与工具】/PostgreSQL/09-PostgreSQL扩展与高级特性|PostgreSQL扩展与高级特性]]
- SQL - SQL基础知识
- [[【数据开发与数据架构】/01-数据开发基础/01-数据开发概述|数据开发基础/数据开发]]

---

> 💡 **记住**：实践是掌握PostgreSQL的最好方法。**不要害怕尝试新的特性和解决方案**。每个项目都是学习的机会，每个问题都是成长的阶梯。PostgreSQL社区非常活跃，**遇到问题时可以积极寻求帮助**。继续保持学习的热情，你一定会成为优秀的数据库专家！