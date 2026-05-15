const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const Razorpay   = require('razorpay');
const crypto     = require('crypto');

const {
  Admin, User, Donation, Volunteer, Campaign,
  Message, Review, NewsItem, FundingRequest, Notification
} = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'hopeandhelp2026';

const razorpayInstance = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID     || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
});

// ── helpers ──────────────────────────────────────────────────────────────────
const sendMail = async (to, subject, html) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const t = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
  await t.sendMail({ from: `"Hope & Help Foundation" <${process.env.EMAIL_USER}>`, to, subject, html });
};

const notify = async ({ audience, userId = null, type, title, message, icon = '🔔', link = '', meta = {} }) => {
  try {
    await Notification.create({ audience, userId, type, title, message, icon, link, meta });
  } catch (e) { console.error('Notification error:', e.message); }
};

const notifyAdmin = (payload) => notify({ audience: 'admin', ...payload });
const notifyUser = (userId, payload) => notify({ audience: 'user', userId, ...payload });
const notifyDonor = (userId, payload) => notify({ audience: 'donor', userId, ...payload });

// ── auth middleware ───────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer '))
    return res.status(401).json({ message: 'No token provided' });
  try {
    req.user = jwt.verify(h.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const donorOnly = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.role !== 'donor') {
      return res.status(403).json({ message: 'Donor login required' });
    }
    next();
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role)
      return res.status(400).json({ message: 'All fields are required.' });
    if (!['user', 'donor'].includes(role))
      return res.status(400).json({ message: 'Invalid role.' });
    if (await User.findOne({ email }))
      return res.status(409).json({ message: 'Email is already registered.' });

    const hashed = await bcrypt.hash(password, 10);
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0EA5E9&color=fff`;
    const u = await User.create({ name, email, password: hashed, role, avatar });
    const token = jwt.sign({ id: u._id, role: u.role }, JWT_SECRET, { expiresIn: '7d' });
    if (role === 'user') {
      await notifyUser(u._id, { type: 'welcome', icon: '👋', title: 'Welcome to Hope Hub', message: `Hi ${name}, your account is ready. You can request funding anytime.`, link: '/user/dashboard' });
      await notifyAdmin({ type: 'signup', icon: '👤', title: 'New Hope Hub member', message: `${name} (${email}) joined as a community member.`, link: '/admin' });
    } else {
      await notifyDonor(u._id, { type: 'welcome', icon: '👋', title: 'Welcome, Donor', message: `Hi ${name}, thank you for joining. Your generosity changes lives.`, link: '/donor/dashboard' });
      await notifyAdmin({ type: 'signup', icon: '💚', title: 'New donor registered', message: `${name} (${email}) joined as a donor.`, link: '/admin' });
    }
    res.status(201).json({ token, user: { id: u._id, name: u.name, email: u.email, role: u.role, avatar: u.avatar, phone: u.phone, city: u.city, bio: u.bio } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (role === 'admin') {
      const admin = await Admin.findOne({ email });
      if (!admin || !(await bcrypt.compare(password, admin.password)))
        return res.status(401).json({ message: 'Invalid credentials' });
      const token = jwt.sign({ id: admin._id, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
      return res.json({ token, user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.name)}&background=7C3AED&color=fff` } });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'No account found with this email.' });
    if (user.role !== role) return res.status(401).json({ message: `This account is registered as "${user.role}", not "${role}".` });
    if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Incorrect password.' });
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, phone: user.phone, city: user.city, bio: user.bio } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/auth/me', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const admin = await Admin.findById(req.user.id).select('-password');
      if (!admin) return res.status(404).json({ message: 'Not found' });
      return res.json({ ...admin.toObject(), role: 'admin',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.name)}&background=7C3AED&color=fff` });
    }
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/auth/profile', auth, async (req, res) => {
  try {
    const { name, email, phone, city, bio, org } = req.body;
    if (req.user.role === 'admin') {
      const admin = await Admin.findByIdAndUpdate(
        req.user.id,
        { name, email, phone, org },
        { new: true, select: '-password', runValidators: true }
      );
      if (!admin) return res.status(404).json({ message: 'Not found' });
      return res.json({
        ...admin.toObject(),
        role: 'admin',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.name)}&background=7C3AED&color=fff`
      });
    }
    const user = await User.findByIdAndUpdate(req.user.id, { name, phone, city, bio }, { new: true, select: '-password' });
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/profile', async (req, res) => {
  try {
    const { name, email, phone, org } = req.body;
    const admin = await Admin.findOneAndUpdate(
      {},
      { name, email, phone, org },
      { new: true, select: '-password', runValidators: true, sort: { createdAt: 1 } }
    );
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    res.json({
      ...admin.toObject(),
      role: 'admin',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.name)}&background=7C3AED&color=fff`
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DONATIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/donations/order', donorOnly, async (req, res) => {
  try {
    if (!req.body.amount || Number(req.body.amount) <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }
    const order = await razorpayInstance.orders.create({ amount: req.body.amount * 100, currency: 'INR', receipt: 'rcpt_' + Date.now() });
    res.json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/donations', donorOnly, async (req, res) => {
  try {
    const { amount, method, frequency, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
    const donor = await User.findById(req.user.id);
    if (!donor) return res.status(404).json({ message: 'Donor account not found' });

    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
      .update(razorpayOrderId + '|' + razorpayPaymentId).digest('hex');
    if (expected !== razorpaySignature) return res.status(400).json({ error: 'Invalid signature' });

    const donation = await Donation.create({
      donorId: donor._id,
      transactionId: razorpayPaymentId,
      name: donor.name,
      email: donor.email,
      amount,
      method,
      frequency,
      status: 'Completed'
    });
    const camps = await Campaign.find();
    if (camps.length) { const c = camps[Math.floor(Math.random() * camps.length)]; c.raised += Number(amount); await c.save(); }

    await sendMail(donor.email, `Thank you for your donation, ${donor.name}!`,
      `<div style="font-family:Arial;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:10px;">
        <h2 style="color:#ea580c;text-align:center;">Thank You, ${donor.name}! ❤️</h2>
        <p>Your donation of <strong>₹${amount}</strong> has been received.</p>
        <p><strong>Transaction ID:</strong> ${razorpayPaymentId}</p>
        <p>Warm Regards,<br/><strong>Hope &amp; Help Foundation</strong></p>
      </div>`);
    const amtStr = `₹${Number(amount).toLocaleString('en-IN')}`;
    await notifyDonor(donor._id, { type: 'donation', icon: '💰', title: 'Donation successful', message: `Thank you! Your ${amtStr} donation was received. Transaction: ${razorpayPaymentId}`, link: '/donor/payments' });
    await notifyAdmin({ type: 'donation', icon: '💰', title: 'New donation received', message: `${donor.name} donated ${amtStr} via ${method || 'Razorpay'}.`, link: '/admin' });
    res.status(201).json(donation);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/donations', async (req, res) => {
  try { res.json(await Donation.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/donations/my', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json(await Donation.find({ $or: [{ donorId: user._id }, { email: user.email }] }).sort({ createdAt: -1 }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  VOLUNTEERS
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/volunteers', async (req, res) => {
  try {
    const { name, email, interest } = req.body;
    const v = await Volunteer.create({ volunteerId: 'VOL-' + Math.floor(100 + Math.random() * 900), name, email, interest });
    await notifyAdmin({ type: 'volunteer', icon: '🙋', title: 'New volunteer', message: `${name} registered as volunteer (${interest || 'General'}).`, link: '/admin' });
    res.status(201).json(v);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/volunteers', async (req, res) => {
  try { res.json(await Volunteer.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/campaigns', async (req, res) => {
  try { res.json(await Campaign.find()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CONTACT MESSAGES  (with reply)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/contact', async (req, res) => {
  try { res.json(await Message.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/contact', async (req, res) => {
  try {
    const { firstName, lastName, email, message } = req.body;
    await Message.create({ firstName, lastName, email, message });
    await notifyAdmin({ type: 'contact', icon: '✉️', title: 'New contact message', message: `${firstName} ${lastName} sent a message via the website.`, link: '/admin' });
    await sendMail('yuvrajrai508@gmail.com',
      `New message from ${firstName} ${lastName}`,
      `<p><b>Name:</b> ${firstName} ${lastName}</p><p><b>Email:</b> ${email}</p><p><b>Message:</b><br/>${message}</p>`);
    res.status(201).json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/contact/:id/reply', async (req, res) => {
  try {
    const { replyText } = req.body;
    if (!replyText?.trim()) return res.status(400).json({ message: 'Reply text required.' });
    const msg = await Message.findByIdAndUpdate(req.params.id,
      { replied: true, replyText: replyText.trim(), repliedAt: new Date() }, { new: true });
    if (!msg) return res.status(404).json({ message: 'Message not found.' });
    await sendMail(msg.email, 'Re: Your message to Hope & Help Foundation',
      `<div style="font-family:Arial;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#0EA5E9;">Hope &amp; Help Foundation</h2>
        <p>Dear <strong>${msg.firstName} ${msg.lastName}</strong>,</p>
        <div style="background:#f8fafc;border-left:4px solid #0EA5E9;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:0;">${replyText}</p>
        </div>
        <p style="color:#64748b;font-size:0.9rem;">Your original message: <em>"${msg.message}"</em></p>
        <p>Warm Regards,<br/><strong>Hope &amp; Help Foundation Team</strong></p>
      </div>`);
    res.json({ success: true, message: msg });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  REVIEWS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/reviews', async (req, res) => {
  try { res.json(await Review.find({ approved: true }).sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reviews/all', async (req, res) => {
  try { res.json(await Review.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/reviews', async (req, res) => {
  try {
    const { name, email, rating, comment } = req.body;
    if (!name || !email || !rating || !comment) return res.status(400).json({ message: 'All fields required.' });
    const review = await Review.create({ name, email, rating: Number(rating), comment });
    await notifyAdmin({ type: 'review', icon: '⭐', title: 'New review submitted', message: `${name} left a ${rating}-star review.`, link: '/admin' });
    res.status(201).json(review);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/reviews/:id', async (req, res) => {
  try { await Review.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FUNDING REQUESTS  (user submits → admin approves/rejects)
// ═══════════════════════════════════════════════════════════════════════════════

// User: submit a funding request (with base64 photo)
router.post('/funding', auth, async (req, res) => {
  try {
    if (req.user.role !== 'user') return res.status(403).json({ message: 'Only users can submit funding requests.' });
    const { title, description, amount, photoUrl } = req.body;
    if (!title || !description || !amount) return res.status(400).json({ message: 'Title, description and amount are required.' });
    const user = await User.findById(req.user.id);
    const fr = await FundingRequest.create({
      userId: user._id, userName: user.name, userEmail: user.email,
      title, description, amount: Number(amount), photoUrl: photoUrl || ''
    });
    const amtStr = `₹${Number(amount).toLocaleString('en-IN')}`;
    await notifyUser(user._id, { type: 'funding', icon: '📋', title: 'Funding request submitted', message: `Your request "${title}" for ${amtStr} was sent. Admin will review it soon.`, link: '/user/funding' });
    await notifyAdmin({ type: 'funding', icon: '📋', title: 'New funding request', message: `${user.name} requested ${amtStr} for "${title}".`, link: '/admin' });
    res.status(201).json(fr);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// User: get own requests
router.get('/funding/my', auth, async (req, res) => {
  try {
    res.json(await FundingRequest.find({ userId: req.user.id }).sort({ createdAt: -1 }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: get all requests
router.get('/funding', async (req, res) => {
  try { res.json(await FundingRequest.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

const getDonationPool = async () => {
  const donations = await Donation.find({
    $or: [{ status: 'Completed' }, { status: { $exists: false } }, { status: '' }]
  });
  return donations.reduce((s, d) => s + (Number(d.amount) || 0), 0);
};

const getApprovedFundingTotal = async (excludeId = null) => {
  const query = { status: 'approved' };
  if (excludeId) query._id = { $ne: excludeId };
  const approved = await FundingRequest.find(query);
  return approved.reduce((s, f) => s + (Number(f.amount) || 0), 0);
};

// Admin: approve or reject
router.put('/funding/:id', async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status.' });

    const existing = await FundingRequest.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Request not found.' });
    if (existing.status !== 'pending') {
      return res.status(400).json({ message: `Request is already ${existing.status}.` });
    }

    if (status === 'approved') {
      const totalDonations = await getDonationPool();
      const alreadyApproved = await getApprovedFundingTotal();
      const remaining = totalDonations - alreadyApproved;
      if (Number(existing.amount) > remaining) {
        return res.status(400).json({
          message: `Cannot approve. Only ₹${Math.max(0, remaining).toLocaleString('en-IN')} left from donations (Total ₹${totalDonations.toLocaleString('en-IN')} − Approved ₹${alreadyApproved.toLocaleString('en-IN')}).`
        });
      }
    }

    const defaultApprovedMessage =
      `Your funding request has been approved for ₹${Number(existing.amount).toLocaleString('en-IN')}! ` +
      'Please send us your bank account details (account holder name, account number, IFSC code, and bank name) so we can transfer the amount.';

    const userMessage = status === 'approved'
      ? (adminNote?.trim() || defaultApprovedMessage)
      : (adminNote?.trim() || `Your funding request "${existing.title}" was not approved at this time. Please contact us if you have questions.`);

    const fr = await FundingRequest.findByIdAndUpdate(
      req.params.id,
      { status, adminNote: adminNote?.trim() || '', userMessage },
      { new: true }
    );
    if (!fr) return res.status(404).json({ message: 'Request not found.' });

    // Notify user by email
    const statusColor = status === 'approved' ? '#10B981' : '#ef4444';
    const statusText  = status === 'approved' ? 'Approved' : 'Rejected';
    await sendMail(fr.userEmail, `Funding request ${statusText} — Hope & Help Foundation`,
      `<div style="font-family:Arial;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:${statusColor};">Request ${statusText}</h2>
        <p>Dear <strong>${fr.userName}</strong>,</p>
        <p>Your funding request "<strong>${fr.title}</strong>" for ₹${fr.amount.toLocaleString('en-IN')} has been <strong>${status}</strong>.</p>
        <div style="background:#f8fafc;border-left:4px solid ${statusColor};padding:14px;border-radius:8px;margin:16px 0;">
          <p style="margin:0;">${userMessage}</p>
        </div>
        <p>Log in to your <strong>Hope Hub</strong> dashboard to view this message anytime.</p>
        <p>Warm Regards,<br/><strong>Hope &amp; Help Foundation Team</strong></p>
      </div>`);

    await notifyUser(fr.userId, {
      type: 'funding_status',
      icon: status === 'approved' ? '✅' : '❌',
      title: status === 'approved' ? 'Funding request approved' : 'Funding request update',
      message: userMessage,
      link: '/user/funding'
    });
    await notifyAdmin({
      type: 'funding_status',
      icon: status === 'approved' ? '✅' : '❌',
      title: `Funding ${status}`,
      message: `You ${status} ${fr.userName}'s request "${fr.title}" (₹${Number(fr.amount).toLocaleString('en-IN')}).`,
      link: '/admin'
    });

    const totalDonations = await getDonationPool();
    const approvedTotal = await getApprovedFundingTotal();
    res.json({
      success: true,
      request: fr,
      stats: {
        totalDonations,
        approvedFunding: approvedTotal,
        remainingDonations: Math.max(0, totalDonations - approvedTotal)
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  NEWS MANAGEMENT  (admin CRUD → frontend fetches)
// ═══════════════════════════════════════════════════════════════════════════════

// Public: get published news
router.get('/news', async (req, res) => {
  try { res.json(await NewsItem.find({ published: true }).sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: get all news
router.get('/news/all', async (req, res) => {
  try { res.json(await NewsItem.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: create news
router.post('/news', async (req, res) => {
  try {
    const { title, description, date, imageUrl, published } = req.body;
    if (!title || !description) return res.status(400).json({ message: 'Title and description required.' });
    const item = await NewsItem.create({ title, description, date: date || new Date().toLocaleDateString('en-IN'), imageUrl: imageUrl || '', published: published !== false });
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: update news
router.put('/news/:id', async (req, res) => {
  try {
    const item = await NewsItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ message: 'Not found.' });
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: delete news
router.delete('/news/:id', async (req, res) => {
  try { await NewsItem.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/notifications/admin', async (req, res) => {
  try {
    const list = await Notification.find({ audience: 'admin' }).sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ audience: 'admin', read: false });
    res.json({ notifications: list, unreadCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/notifications/my', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const list = await Notification.find({ audience: 'admin' }).sort({ createdAt: -1 }).limit(50);
      const unreadCount = await Notification.countDocuments({ audience: 'admin', read: false });
      return res.json({ notifications: list, unreadCount });
    }
    if (!['user', 'donor'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const list = await Notification.find({ audience: req.user.role, userId: req.user.id })
      .sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ audience: req.user.role, userId: req.user.id, read: false });
    res.json({ notifications: list, unreadCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/notifications/:id/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/notifications/read-all', async (req, res) => {
  try {
    const { audience, userId } = req.body;
    const q = { read: false };
    if (audience) q.audience = audience;
    if (userId) q.userId = userId;
    await Notification.updateMany(q, { read: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
