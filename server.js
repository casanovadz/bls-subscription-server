const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// قاعدة بيانات مؤقتة (استبدلها بقاعدة بيانات حقيقية)
// قاعدة بيانات الاشتراكات - محدثة
let subscriptions = {
    "BLSDZ001": { 
        active: true, 
        expiry: "2024-12-31", 
        plan: "monthly",
        createdAt: "2024-01-01"
    },
    "BLSDZ002": { 
        active: true, 
        expiry: "2024-11-30", 
        plan: "monthly",
        createdAt: "2024-01-15"
    },
    "BLSDZ003": { 
        active: true, 
        expiry: "2025-01-01", 
        plan: "monthly",
        createdAt: "2024-01-20"
    },
    "TESTFREE": { 
        active: true, 
        expiry: "2024-12-31", 
        plan: "monthly",
        createdAt: "2024-01-01"
    },
    "CASANOVA001": { 
        active: true, 
        expiry: "2024-12-31", 
        plan: "monthly",
        createdAt: "2024-01-01"
    }
};



// ==== الروابط الأساسية ====

// التحقق من صحة التوكن
app.get('/verify-token', (req, res) => {
    const token = req.query.token;
    
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
        // تحديث الحالة إلى غير نشط إذا انتهت الصلاحية
        subscriptions[token].active = false;
        return res.json({ 
            valid: false, 
            error: "انتهت صلاحية الاشتراك" 
        });
    }

    // حساب الأيام المتبقية
    const daysLeft = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
    
    res.json({
        valid: true,
        expiry: subscription.expiry,
        daysLeft: daysLeft,
        plan: subscription.plan,
        active: true
    });
});

// إنشاء اشتراك جديد (للاستخدام الداخلي)
app.post('/create-subscription', (req, res) => {
    const { token, expiry, plan = "monthly" } = req.body;
    
    // تحقق من الصلاحيات (يمكنك إضافة تحقق أكثر تعقيداً)
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
        return res.status(401).json({ error: "غير مصرح" });
    }

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

    res.json({ 
        success: true, 
        message: "تم إنشاء الاشتراك بنجاح",
        token: token
    });
});

// تجديد اشتراك موجود
app.post('/renew-subscription', (req, res) => {
    const { token, months = 1 } = req.body;
    
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
        return res.status(401).json({ error: "غير مصرح" });
    }

    if (!subscriptions[token]) {
        return res.status(404).json({ error: "رمز الاشتراك غير موجود" });
    }

    const currentExpiry = new Date(subscriptions[token].expiry);
    const currentDate = new Date();
    
    // إذا انتهت الصلاحية، ابدأ من اليوم، وإذا لا زالت سارية أضف للأجل الحالي
    let newExpiry = currentExpiry > currentDate ? currentExpiry : currentDate;
    newExpiry.setMonth(newExpiry.getMonth() + months);
    
    subscriptions[token].expiry = newExpiry.toISOString().split('T')[0];
    subscriptions[token].active = true;

    res.json({
        success: true,
        message: `تم تجديد الاشتراك لـ ${months} أشهر`,
        newExpiry: subscriptions[token].expiry
    });
});

// تعطيل اشتراك
app.post('/deactivate-subscription', (req, res) => {
    const { token } = req.body;
    
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
        return res.status(401).json({ error: "غير مصرح" });
    }

    if (!subscriptions[token]) {
        return res.status(404).json({ error: "رمز الاشتراك غير موجود" });
    }

    subscriptions[token].active = false;

    res.json({
        success: true,
        message: "تم تعطيل الاشتراك بنجاح"
    });
});

// الحصول على معلومات جميع الاشتراكات (للوحة التحكم)
app.get('/admin/subscriptions', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
        return res.status(401).json({ error: "غير مصرح" });
    }

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

// روابط اختبار سريعة
console.log('🎯 روابط الاختبار:');
console.log('📍 الصحة: http://localhost:3000/health');
console.log('✅ TESTFREE: http://localhost:3000/verify-token?token=TESTFREE');
console.log('✅ BLSDZ001: http://localhost:3000/verify-token?token=BLSDZ001');
console.log('✅ CASANOVA001: http://localhost:3000/verify-token?token=CASANOVA001');
console.log('❌ غير موجود: http://localhost:3000/verify-token?token=INVALID');
// إنشاء توكنات جماعية
app.post('/admin/generate-tokens', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
        return res.status(401).json({ error: "غير مصرح" });
    }

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

    res.json({
        success: true,
        message: `تم إنشاء ${count} رمز اشتراك`,
        tokens: generatedTokens
    });
});

// رابط الصحة
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'BLS Subscription Server is running',
        timestamp: new Date().toISOString()
    });
});

// رابط رئيسي
app.get('/', (req, res) => {
    res.json({ 
        message: 'مرحباً بك في خادم إدارة اشتراكات BLS',
        endpoints: {
            verify: '/verify-token?token=YOUR_TOKEN',
            health: '/health',
            admin: '/admin/subscriptions'
        }
    });
});

// معالج الأخطاء
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
});

// بدء الخادم
app.listen(PORT, () => {
    console.log(`🚀 BLS Subscription Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
});