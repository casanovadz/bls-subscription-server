const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// قاعدة بيانات الاشتراكات - محدثة
let subscriptions = {
    "BLSDZ001": { 
        active: true, 
        expiry: "2025-12-31",
        plan: "monthly",
        createdAt: "2025-10-02"
    },
    "BLSDZ002": { 
        active: true, 
        expiry: "2025-12-31",
        plan: "monthly",
        createdAt: "2024-01-15"
    },
    "BLSDZ003": { 
        active: true, 
        expiry: "2025-12-31",
        plan: "monthly",
        createdAt: "2024-01-20"
    },
    "TESTFREE": { 
        active: true, 
        expiry: "2025-12-31",
        plan: "monthly",
        createdAt: "2024-01-01"
    },
    "CASANOVA001": { 
        active: true, 
        expiry: "2025-12-31",
        plan: "monthly",
        createdAt: "2025-10-02"
    }
};

// ==== التحقق من صحة التوكن ====
app.get('/verify-token', (req, res) => {
    const token = req.query.token;
    
    console.log('🔍 طلب تحقق من التوكن:', token);
    
    if (!token) {
        return res.json({ 
            valid: false, 
            error: "لم يتم تقديم رمز الاشتراك" 
        });
    }

    const subscription = subscriptions[token];
    
    if (!subscription) {
        return res.json({ 
            valid: false, 
            error: "رمز الاشتراك غير موجود" 
        });
    }

    const currentDate = new Date();
    const expiryDate = new Date(subscription.expiry);
    
    if (!subscription.active) {
        return res.json({ 
            valid: false, 
            error: "الاشتراك غير مفعل" 
        });
    }

    if (expiryDate < currentDate) {
        subscriptions[token].active = false;
        return res.json({ 
            valid: false, 
            error: "انتهت صلاحية الاشتراك" 
        });
    }

    const daysLeft = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
    
    console.log('✅ توكن صالح:', token, 'متبقي:', daysLeft, 'أيام');
    
    res.json({
        valid: true,
        expiry: subscription.expiry,
        daysLeft: daysLeft,
        plan: subscription.plan,
        active: true,
        message: "الاشتراك ساري المفعول"
    });
});

// ==== إدارة الاشتراكات (بدون مصادقة) ====

// الحصول على جميع الاشتراكات
app.get('/admin/subscriptions', (req, res) => {
    console.log('📊 طلب الحصول على قائمة الاشتراكات');
    
    const subscriptionList = Object.entries(subscriptions).map(([token, data]) => ({
        token,
        ...data,
        status: data.active && new Date(data.expiry) > new Date() ? 'active' : 'expired'
    }));

    res.json({
        total: subscriptionList.length,
        active: subscriptionList.filter(sub => sub.status === 'active').length,
        expired: subscriptionList.filter(sub => sub.status === 'expired').length,
        subscriptions: subscriptionList
    });
});

// إنشاء توكنات جماعية
app.post('/admin/generate-tokens', (req, res) => {
    console.log('🎫 طلب إنشاء توكنات جديدة:', req.body);
    
    const { count = 1, months = 1, prefix = "BLS" } = req.body;
    const generatedTokens = [];

    for (let i = 0; i < count; i++) {
        const token = `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + months);
        
        subscriptions[token] = {
            active: true,
            expiry: expiry.toISOString().split('T')[0],
            plan: "monthly",
            createdAt: new Date().toISOString().split('T')[0]
        };

        generatedTokens.push({
            token: token,
            expiry: subscriptions[token].expiry
        });
    }

    console.log(`✅ تم إنشاء ${count} توكن جديد`);
    
    res.json({
        success: true,
        message: `تم إنشاء ${count} رمز اشتراك`,
        tokens: generatedTokens
    });
});

// إنشاء اشتراك جديد
app.post('/create-subscription', (req, res) => {
    const { token, expiry, plan = "monthly" } = req.body;
    
    console.log('➕ طلب إنشاء اشتراك جديد:', token);
    
    if (!token || !expiry) {
        return res.status(400).json({ error: "البيانات غير مكتملة" });
    }

    if (subscriptions[token]) {
        return res.status(400).json({ error: "رمز الاشتراك موجود مسبقاً" });
    }

    subscriptions[token] = {
        active: true,
        expiry: expiry,
        plan: plan,
        createdAt: new Date().toISOString().split('T')[0]
    };

    console.log('✅ تم إنشاء اشتراك جديد:', token);
    
    res.json({ 
        success: true, 
        message: "تم إنشاء الاشتراك بنجاح",
        token: token
    });
});

// تجديد اشتراك موجود
app.post('/renew-subscription', (req, res) => {
    const { token, months = 1 } = req.body;
    
    console.log('🔄 طلب تجديد اشتراك:', token);
    
    if (!subscriptions[token]) {
        return res.status(404).json({ error: "رمز الاشتراك غير موجود" });
    }

    const currentExpiry = new Date(subscriptions[token].expiry);
    const currentDate = new Date();
    
    let newExpiry = currentExpiry > currentDate ? currentExpiry : currentDate;
    newExpiry.setMonth(newExpiry.getMonth() + months);
    
    subscriptions[token].expiry = newExpiry.toISOString().split('T')[0];
    subscriptions[token].active = true;

    console.log('✅ تم تجديد الاشتراك:', token, 'لـ', newExpiry.toISOString().split('T')[0]);
    
    res.json({
        success: true,
        message: `تم تجديد الاشتراك لـ ${months} أشهر`,
        newExpiry: subscriptions[token].expiry
    });
});

// تعطيل اشتراك
app.post('/deactivate-subscription', (req, res) => {
    const { token } = req.body;
    
    console.log('❌ طلب تعطيل اشتراك:', token);
    
    if (!subscriptions[token]) {
        return res.status(404).json({ error: "رمز الاشتراك غير موجود" });
    }

    subscriptions[token].active = false;

    console.log('✅ تم تعطيل الاشتراك:', token);
    
    res.json({
        success: true,
        message: "تم تعطيل الاشتراك بنجاح"
    });
});

// ==== روابط الخدمة ====

// رابط الصحة
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'BLS Subscription Server is running',
        timestamp: new Date().toISOString(),
        totalSubscriptions: Object.keys(subscriptions).length,
        version: '2.0 - No Auth'
    });
});

// رابط رئيسي
app.get('/', (req, res) => {
    res.json({ 
        message: '🚀 BLS Doorstep Subscription Server',
        author: 'CasanovaDZ',
        version: '2.0 - No Authentication',
        status: 'يعمل بنجاح',
        endpoints: {
            verify: '/verify-token?token=YOUR_TOKEN',
            health: '/health',
            admin: '/admin/subscriptions',
            generate_tokens: '/admin/generate-tokens',
            test: '/verify-token?token=TESTFREE'
        },
        note: 'جميع الخدمات متاحة بدون مصادقة'
    });
});

// معالج الأخطاء
app.use((err, req, res, next) => {
    console.error('❌ خطأ في الخادم:', err);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
});

// بدء الخادم
app.listen(PORT, () => {
    console.log(`🚀 BLS Subscription Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 Verify token: http://localhost:${PORT}/verify-token?token=TESTFREE`);
    console.log(`📍 Admin panel: http://localhost:${PORT}/admin/subscriptions`);
    console.log(`📊 Total subscriptions: ${Object.keys(subscriptions).length}`);
    console.log(`🔓 الوضع: بدون مصادقة - جميع الخدمات مفتوحة`);
});