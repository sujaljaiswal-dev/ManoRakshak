const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Journal = require('../models/Journal');
const Message = require('../models/Message');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Generate journal from today's chats
router.post('/generate', protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get today's messages
    const startOfDay = new Date(today);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59);

    const messages = await Message.find({
      userId: req.user._id,
      isIncognito: false,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ createdAt: 1 });

    if (messages.length === 0) {
      return res.status(400).json({ message: 'No conversations found for today' });
    }

    const convoText = messages.map(m => `${m.role === 'user' ? 'User' : 'MindSaathi'}: ${m.content}`).join('\n');

    const avgStress = messages
      .filter(m => m.stressScore !== null)
      .reduce((acc, m) => acc + (m.stressScore || 0), 0) / Math.max(messages.filter(m => m.stressScore !== null).length, 1);

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_JOURNAL_MODEL || 'mixtral-8x7b-32768',
      messages: [
        {
          role: 'system',
          content: 'You are a mental health journaling assistant. Convert the following conversation into a warm, reflective, first-person journal entry. Make it personal, empathetic, and end with a positive affirmation or coping tip.',
        },
        { role: 'user', content: convoText },
      ],
      max_tokens: 400,
    });

    const journalContent = completion.choices[0].message.content;

    // Determine mood from stress level
    let mood = 'okay';
    if (avgStress <= 1) mood = 'great';
    else if (avgStress <= 3) mood = 'good';
    else if (avgStress <= 5) mood = 'okay';
    else if (avgStress <= 7) mood = 'low';
    else mood = 'terrible';

    // Upsert journal entry
    const journal = await Journal.findOneAndUpdate(
      { userId: req.user._id, date: today },
      { username: req.user.username, content: journalContent, mood, stressScore: Math.round(avgStress), aiSummary: journalContent },
      { upsert: true, new: true }
    );

    res.json(journal);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET all journals
router.get('/', protect, async (req, res) => {
  try {
    const journals = await Journal.find({ userId: req.user._id }).sort({ date: -1 });
    res.json(journals);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET single journal by date
router.get('/:date', protect, async (req, res) => {
  try {
    const journal = await Journal.findOne({ userId: req.user._id, date: req.params.date });
    if (!journal) return res.status(404).json({ message: 'No journal found for this date' });
    res.json(journal);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST manual journal entry
router.post('/manual', protect, async (req, res) => {
  try {
    const { content, mood } = req.body;
    const today = new Date().toISOString().split('T')[0];

    const journal = await Journal.findOneAndUpdate(
      { userId: req.user._id, date: today },
      { username: req.user.username, content, mood },
      { upsert: true, new: true }
    );
    res.json(journal);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
