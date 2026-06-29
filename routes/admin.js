const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/admin/login');
}

// Login
router.get('/login', (req, res) => res.render('login', { error: null }));

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'nusakece';
  const adminPass = process.env.ADMIN_PASSWORD || 'NusaJosjis2025';
  if (username === adminUser && password === adminPass) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Username atau password salah' });
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/admin/login'); });

// Dashboard
router.get('/', requireAuth, async (req, res) => {
  const totalProducts = await prisma.product.count({ where: { isActive: true } });
  const totalOrders = await prisma.order.count();
  const totalRevenue = await prisma.order.aggregate({
    _sum: { totalAmount: true },
    where: { status: { in: ['paid', 'delivered'] } },
  });
  const totalUsers = await prisma.user.count();
  const recentOrders = await prisma.order.findMany({
    take: 10, orderBy: { createdAt: 'desc' },
    include: { user: true, items: { include: { product: true } } },
  });
  res.render('dashboard', { totalProducts, totalOrders, totalRevenue: totalRevenue._sum.totalAmount || 0, totalUsers, recentOrders });
});

// Products
router.get('/products', requireAuth, async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
  res.render('products', { products });
});

router.get('/products/add', requireAuth, (req, res) => {
  res.render('product-form', { product: null });
});

router.post('/products', requireAuth, async (req, res) => {
  const { name, description, price, durationDays, groupId } = req.body;
  await prisma.product.create({
    data: { name, description, price: parseInt(price), durationDays: parseInt(durationDays), groupId: groupId || null },
  });
  res.redirect('/admin/products');
});

router.get('/products/:id/edit', requireAuth, async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } });
  res.render('product-form', { product });
});

router.post('/products/:id', requireAuth, async (req, res) => {
  const { name, description, price, durationDays, groupId, isActive } = req.body;
  await prisma.product.update({
    where: { id: parseInt(req.params.id) },
    data: { name, description, price: parseInt(price), durationDays: parseInt(durationDays), groupId: groupId || null, isActive: isActive === 'on' },
  });
  res.redirect('/admin/products');
});

router.post('/products/:id/toggle', requireAuth, async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } });
  await prisma.product.update({
    where: { id: parseInt(req.params.id) },
    data: { isActive: !product.isActive },
  });
  res.redirect('/admin/products');
});

router.post('/products/:id/delete', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.orderItem.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
  } catch (e) { console.error('Delete error:', e); }
  res.redirect('/admin/products');
});

// Orders
router.get('/orders', requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: true, items: { include: { product: true } } },
  });

  const now = Date.now();
  const ordersWithDuration = orders.map(order => {
    const product = order.items[0]?.product;
    const durationDays = product?.durationDays || 0;
    const expiresAt = new Date(order.createdAt.getTime() + durationDays * 86400000);
    const isActive = order.status === 'delivered' && now < expiresAt.getTime();
    const isExpired = order.status === 'delivered' && now >= expiresAt.getTime();

    return {
      ...order,
      durationDays,
      expiresAt,
      membershipStatus: isExpired ? 'expired' : isActive ? 'active' : order.status,
    };
  });

  res.render('orders', { orders: ordersWithDuration });
});

// Users
router.get('/users', requireAuth, async (req, res) => {
  const users = await prisma.user.findMany({
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.render('users', { users });
});

module.exports = router;
