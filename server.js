const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// قاعدة بيانات الاشتراكات - محدثة مع دعم الجهاز
let subscriptions = {
    "BLSDZ0018948484848454545454GTGTYY": { 
        active: true, 
        expiry: "2026-04-05",
        plan: "monthly",
        createdAt: "2026-03-29",
        registeredDevice: null // ← الحقل الجديد
    },
    "BLSDZ00248484846445465656GYGUHHHB": { 
        active: true, 
        expiry: "2026-04-05",
        plan: "monthly",
        createdAt: "2026-03-29",
        registeredDevice: null
    },
    "BLSDZ003958959595859594YGTFTYGYGY": { 
        active: true, 
        expiry: "2026-04-25",
        plan: "monthly",
        createdAt: "2026-03-25",
        registeredDevice: null
    },
    "TESTFREE": { 
        active: true, 
        expiry: "2026-12-30",
        plan: "monthly",
        createdAt: "2026-04-25",
        registeredDevice: null
     },
    "BLSDZ77827271759449505535N7HTJ": { 
        active: true, 
        expiry: "2026-04-25",
        plan: "monthly",
        createdAt: "2026-03-25",
        registeredDevice: null
    },
    "BLSDZ77827271759449505535ETTNK": { 
        active: true, 
        expiry: "2026-04-25",
        plan: "monthly",
        createdAt: "2026-03-25",
        registeredDevice: null
    },
    "BLSDZ77827271759449505535GRJRR": { 
        active: true, 
        expiry: "2026-04-25",
        plan: "monthly",
        createdAt: "2026-03-25",
        registeredDevice: null
    },
    "BLSDZ778272717594495055351A6E4": { 
        active: true, 
        expiry: "2026-04-25",
        plan: "monthly",
        createdAt: "2026-03-25",
        registeredDevice: null
    },
    "BLSDZ7782727175944950553520HGN": { 
        active: true, 
        expiry: "2026-12-30",
        plan: "monthly",
        createdAt: "2026-04-25",
        registeredDevice: null       
    },
    "CASANOVA001": { 
        active: true, 
        expiry: "2026-12-30",
        plan: "monthly",
        createdAt: "2025-11-15",
        registeredDevice: null
    }
};

// ==== التحقق من صحة التوكن مع دعم الجهاز ====
app.get('/verify-token', (req, res) => {
    const token = req.query.token;
    const device_id = req.query.device_id; // ← المعلمة الجديدة
    
    console.log('🔍 طلب تحقق من التوكن:', token, 'الجهاز:', device_id);
    
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

    // ==== التحقق من الجهاز ====
    if (subscription.registeredDevice) {
        // إذا كان هناك جهاز مسجل مسبقاً
        if (subscription.registeredDevice !== device_id) {
            console.log('❌ محاولة استخدام التوكن على جهاز مختلف:', {
                المسجل: subscription.registeredDevice,
                الحالي: device_id
            });
            
            return res.json({ 
                valid: false, 
                error: "هذا التوكن مستخدم بالفعل على جهاز آخر. الاشتراك صالح لجهاز واحد فقط." 
            });
        }
    } else {
        // إذا لم يكن هناك جهاز مسجل، نقوم بتسجيل الجهاز الجديد
        console.log('✅ تسجيل جهاز جديد للتوكن:', device_id);
        subscriptions[token].registeredDevice = device_id;
    }

    const daysLeft = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
    
    console.log('✅ توكن صالح:', token, 'متبقي:', daysLeft, 'أيام', 'الجهاز:', device_id);
    
    res.json({
        valid: true,
        expiry: subscription.expiry,
        daysLeft: daysLeft,
        plan: subscription.plan,
        active: true,
        deviceRegistered: !!subscription.registeredDevice,
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
        status: data.active && new Date(data.expiry) > new Date() ? 'active' : 'expired',
        deviceInfo: data.registeredDevice ? 
            `✅ مسجل (${data.registeredDevice.substring(0, 10)}...)` : 
            '❌ غير مسجل'
    }));

    res.json({
        total: subscriptionList.length,
        active: subscriptionList.filter(sub => sub.status === 'active').length,
        expired: subscriptionList.filter(sub => sub.status === 'expired').length,
        withDevice: subscriptionList.filter(sub => sub.registeredDevice).length,
        withoutDevice: subscriptionList.filter(sub => !sub.registeredDevice).length,
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
            createdAt: new Date().toISOString().split('T')[0],
            registeredDevice: null // ← تأكد من إضافة الحقل الجديد
        };

        generatedTokens.push({
            token: token,
            expiry: subscriptions[token].expiry,
            note: "✅ يدعم نظام الجهاز الواحد"
        });
    }

    console.log(`✅ تم إنشاء ${count} توكن جديد مع دعم الجهاز`);
    
    res.json({
        success: true,
        message: `تم إنشاء ${count} رمز اشتراك مع دعم نظام الجهاز الواحد`,
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
        createdAt: new Date().toISOString().split('T')[0],
        registeredDevice: null // ← الحقل الجديد
    };

    console.log('✅ تم إنشاء اشتراك جديد مع دعم الجهاز:', token);
    
    res.json({ 
        success: true, 
        message: "تم إنشاء الاشتراك بنجاح مع دعم نظام الجهاز الواحد",
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
        newExpiry: subscriptions[token].expiry,
        note: "تم الحفاظ على إعدادات الجهاز المسجل"
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

// ==== إدارة الأجهزة ====

// إلغاء قفل جهاز (للمشرفين)
app.post('/admin/unlock-device', (req, res) => {
    const { token } = req.body;
    
    console.log('🔓 طلب إلغاء قفل جهاز للتوكن:', token);
    
    if (!subscriptions[token]) {
        return res.status(404).json({ error: "رمز الاشتراك غير موجود" });
    }

    const oldDevice = subscriptions[token].registeredDevice;
    subscriptions[token].registeredDevice = null;

    console.log('✅ تم إلغاء قفل الجهاز:', token, 'الجهاز السابق:', oldDevice);
    
    res.json({
        success: true,
        message: "تم إلغاء قفل الجهاز بنجاح",
        previousDevice: oldDevice,
        note: "يمكن الآن استخدام التوكن على أي جهاز"
    });
});

// نقل الاشتراك إلى جهاز جديد
app.post('/transfer-device', (req, res) => {
    const { token, new_device_id } = req.body;
    
    console.log('🔄 طلب نقل اشتراك إلى جهاز جديد:', token);
    
    if (!subscriptions[token]) {
        return res.status(404).json({ error: "رمز الاشتراك غير موجود" });
    }

    const oldDevice = subscriptions[token].registeredDevice;
    subscriptions[token].registeredDevice = new_device_id;

    console.log('✅ تم نقل الاشتراك:', {
        token: token,
        من: oldDevice,
        إلى: new_device_id
    });
    
    res.json({
        success: true,
        message: "تم نقل الاشتراك إلى الجهاز الجديد بنجاح",
        previousDevice: oldDevice,
        newDevice: new_device_id
    });
});

// الحصول على إحصائيات الأجهزة
app.get('/admin/device-stats', (req, res) => {
    const stats = {
        totalSubscriptions: Object.keys(subscriptions).length,
        withDevice: Object.values(subscriptions).filter(sub => sub.registeredDevice).length,
        withoutDevice: Object.values(subscriptions).filter(sub => !sub.registeredDevice).length,
        activeSubscriptions: Object.values(subscriptions).filter(sub => 
            sub.active && new Date(sub.expiry) > new Date()
        ).length
    };

    console.log('📈 طلب إحصائيات الأجهزة');
    
    res.json(stats);
});

// ==== روابط الخدمة ====

// رابط الصحة
app.get('/health', (req, res) => {
    const deviceStats = Object.values(subscriptions).reduce((acc, sub) => {
        if (sub.registeredDevice) acc.withDevice++;
        else acc.withoutDevice++;
        return acc;
    }, { withDevice: 0, withoutDevice: 0 });

    res.json({ 
        status: 'OK', 
        message: 'BLS Subscription Server is running',
        timestamp: new Date().toISOString(),
        totalSubscriptions: Object.keys(subscriptions).length,
        deviceStats: deviceStats,
        version: '3.0 - Device Lock System'
    });
});

// رابط رئيسي
app.get('/', (req, res) => {
    res.json({ 
        message: '🚀 BLS Doorstep Subscription Server',
        author: 'CasanovaDZ',
        version: '3.0 - Device Lock System',
        status: 'يعمل بنجاح',
        features: [
            'نظام التحقق من التوكن',
            'نظام الجهاز الواحد لكل اشتراك',
            'إدارة الاشتراكات',
            'نقل الأجهزة'
        ],
        endpoints: {
            verify: '/verify-token?token=YOUR_TOKEN&device_id=DEVICE_ID',
            health: '/health',
            admin: '/admin/subscriptions',
            generate_tokens: '/admin/generate-tokens',
            device_stats: '/admin/device-stats',
            unlock_device: '/admin/unlock-device',
            test: '/verify-token?token=TESTFREE&device_id=test_device'
        },
        note: 'جميع الخدمات متاحة بدون مصادقة - نظام الجهاز الواحد مفعل'
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
    console.log(`📍 Verify token: http://localhost:${PORT}/verify-token?token=TESTFREE&device_id=test_device`);
    console.log(`📍 Admin panel: http://localhost:${PORT}/admin/subscriptions`);
    console.log(`📊 Total subscriptions: ${Object.keys(subscriptions).length}`);
    console.log(`🔒 النظام: مفعل - جهاز واحد لكل اشتراك`);
    console.log(`💡 مثال: /verify-token?token=TESTFREE&device_id=device_123456`);
});
