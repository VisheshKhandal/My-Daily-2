const express = require('express');
const router = express.Router();
const Entry = require('../models/Entry');
const auth = require('../middleware/auth');

// Get all entries for the logged-in user
router.get('/', auth, async (req, res) => {
  const entries = await Entry.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json(entries);
});

// Create a new entry
router.post('/', auth, async (req, res) => {
  const entry = new Entry({ ...req.body, user: req.user.id });
  await entry.save();
  res.status(201).json(entry);
});

// Update an entry
router.put('/:id', auth, async (req, res) => {
  const entry = await Entry.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    req.body,
    { new: true }
  );
  res.json(entry);
});

// Delete an entry
router.delete('/:id', auth, async (req, res) => {
  await Entry.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  res.json({ success: true });
});

module.exports = router; 