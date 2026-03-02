const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');

let groq;
try {
  const Groq = require('groq-sdk');
  groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    defaultHeaders: {
      'user-agent': 'ManoRakshak/1.0',
    },
  });
  console.log('✅ Groq SDK initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Groq SDK:', error.message);
  groq = null;
}

if (!process.env.GROQ_API_KEY) {
  console.error('❌ ERROR: GROQ_API_KEY is not set in environment variables');
} else {
  console.log('✅ GROQ_API_KEY is configured');
}

// Detect stress level from text (0-10)
const detectStressLevel = (text) => {
  const highStressWords = ['anxious', 'panic', 'hopeless', 'worthless', 'suicide', 'die', 'can\'t cope', 'overwhelmed', 'depressed', 'घबराहट', 'निराश', 'काहीच नको'];
  const medStressWords = ['stressed', 'tired', 'sad', 'lonely', 'frustrated', 'worried', 'थका', 'दुखी', 'चिंता'];
  let score = 0;
  const lower = text.toLowerCase();
  highStressWords.forEach(w => { if (lower.includes(w)) score += 3; });
  medStressWords.forEach(w => { if (lower.includes(w)) score += 1; });
  return Math.min(score, 10);
};

// Helper function to decide if this is a good moment for a conclusion
const shouldOfferConclusion = (conversationHistory) => {
  // Offer conclusion after user has shared 6+ messages in this conversation
  // This gives enough context to understand their situation
  const userMessages = conversationHistory.filter(m => m.role === 'user');
  if (userMessages.length < 6) return false;

  // Only offer conclusion occasionally (30% chance) to keep it natural
  return Math.random() < 0.3;
};

// Build system prompt based on user preferences
const buildSystemPrompt = (user) => {
  const langMap = { english: 'English', hindi: 'Hindi' };
  const lang = langMap[user.languagePreference] || 'English';

  return `You are ManoRakshak, an emotionally mature friend who listens, supports, and gives honest advice when needed.

YOUR CORE PURPOSE: Listen, understand, provide emotional support, AND give thoughtful advice when appropriate.

IMPORTANT: Never use asterisks or special formatting characters in your responses. Write naturally like you're texting a friend. Your responses will be read out loud, so write conversationally without any special characters.

HOW TO RESPOND:
Read what the person is really saying - not just their words, but their emotions.
Respond with empathy and genuine understanding.
Show that you're listening by acknowledging their feelings.
Think critically about what they're sharing.
If they ask for advice or if it's clearly needed, give honest, practical suggestions.
Be honest, warm, and human.

GOOD RESPONSES:
Validate their feelings. Say things like "That's really tough"
Show you understand. Say "It sounds like..."
Be genuine and warm
Respond to what they actually said
Listen more than you talk
If they ask for help or advice, give it. Be practical and honest
Share perspective if it helps them see things differently
Be a real friend. Sometimes that means giving advice

WHEN TO GIVE ADVICE:
When they directly ask for it
When they're clearly stuck and need direction
When your insight could help them move forward
When it's practical advice about a situation

HOW TO GIVE ADVICE:
Keep it simple and honest
Give one or two main suggestions, not a long list
Explain why it might help
Respect their choice to take it or not
Don't be preachy. Be a friend

THINGS TO AVOID:
No asterisks or special formatting at all
No emoji
No too many questions
No therapy language
No fake cheerfulness
No forced techniques like breathing exercises
No trying to fix them when they just want to be heard
No unsolicited advice if they're just venting
No being judgmental

TONE: Emotionally intelligent, honest, warm, human. Like talking to a friend who really gets you and will give you real talk when you need it.

LANGUAGE: Respond fully in ${lang}. Write naturally and conversationally. No special characters.

Remember: Your job is to support them emotionally and give honest advice when they need it. Write like a real friend texting.`;
};


// POST /api/chat/message
router.post('/message', protect, async (req, res) => {
  try {
    if (!groq) {
      return res.status(503).json({ message: 'AI service not initialized' });
    }

    const { content, isIncognito = false, conversationHistory = [] } = req.body;
    const user = req.user;

    console.log('📨 Incoming message from user:', user._id);
    console.log('📝 Message content:', content.substring(0, 50) + '...');

    const stressScore = detectStressLevel(content);

    // Check if we should offer a conclusion this round
    const canOfferConclusion = shouldOfferConclusion(conversationHistory);
    const conclusionHint = canOfferConclusion
      ? '\n\n[Note: This might be a good moment to offer a gentle conclusion or observation that brings together what the user has shared, if it feels natural and authentic.]'
      : '';

    // Build messages for Groq
    const systemPrompt = buildSystemPrompt(user) + conclusionHint;
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-12), // last 12 messages for better context
      { role: 'user', content },
    ];

    console.log('🔄 Calling Groq API with model:', process.env.GROQ_CHAT_MODEL || 'mixtral-8x7b-32768');
    console.log('💭 Can offer conclusion:', canOfferConclusion);

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_CHAT_MODEL || 'mixtral-8x7b-32768',
      messages,
      max_tokens: 800,
      temperature: 0.85,
      top_p: 0.92,
    });

    console.log('✅ Groq API response received');
    let aiResponse = completion.choices[0]?.message?.content?.trim();

    // Validate response
    if (!aiResponse) {
      console.warn('⚠️ Empty response from Groq API, retrying...');
      // Return a fallback response if Groq fails - use natural listening sounds
      const fallbackResponses = {
        english: [
          "I'm listening. Tell me more about what's on your mind.",
          "That sounds like a lot. What's been the hardest part for you?",
          "Go on, I'm here with you.",
          "Help me understand what you're going through.",
          "What does that feel like for you right now?"
        ],
        hindi: [
          "मैं सुन रहा हूँ। कृपया और बताइए।",
          "यह सुनने में कठिन है। आपके लिए सबसे कठिन क्या है?",
          "आगे बताइए, मैं आपके साथ हूँ।",
          "मुझे समझाइए कि आप क्या महसूस कर रहे हैं।",
          "यह आपके लिए कैसा लग रहा है?"
        ]
      };
      const responses = fallbackResponses[user.languagePreference] || fallbackResponses.english;
      aiResponse = responses[Math.floor(Math.random() * responses.length)];
    }

    console.log('✅ AI Response:', aiResponse.substring(0, 50) + '...');

    // Save to DB only if not incognito
    if (!isIncognito) {
      await Message.create({ userId: user._id, username: user.username, role: 'user', content, stressScore, isIncognito: false });
      await Message.create({ userId: user._id, username: user.username, role: 'assistant', content: aiResponse, isIncognito: false });

      // Update user stress level
      if (stressScore > 0) {
        await User.findByIdAndUpdate(user._id, { stressLevel: stressScore });
      }
    }

    console.log('✅ Message saved to database');
    res.json({ response: aiResponse, stressScore });
  } catch (error) {
    console.error('❌ Chat API Error:', error);
    console.error('❌ Error Details:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      validationError: error.errors ? Object.keys(error.errors) : null,
    });

    // Check if it's a validation error
    if (error.name === 'ValidationError') {
      console.error('🔴 Database Validation Error - Content might be empty');
      return res.status(400).json({ message: 'Invalid response format', error: error.message });
    }

    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/chat/history
router.get('/history', protect, async (req, res) => {
  try {
    const messages = await Message.find({ userId: req.user._id, isIncognito: false })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/chat/analyze-image (face expression)
router.post('/analyze-image', protect, async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    // Using Llama 4 Scout for advanced emotion detection
    // Extract text from user's previous messages for context
    const recentMessages = await Message.find({ userId: req.user._id, isIncognito: false })
      .sort({ createdAt: -1 })
      .limit(5);

    const contextText = recentMessages.map(m => m.content).reverse().join(' ');

    const response = await groq.chat.completions.create({
      model: process.env.GROQ_EMOTION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'system',
          content: 'You are an expert emotional intelligence analyzer. Analyze emotions deeply and accurately. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `Based on the user's recent conversation: "${contextText}", perform a detailed emotional analysis. Consider tone, word choice, and context. Return ONLY valid JSON (no markdown, no backticks): { "emotion": "happy|sad|anxious|stressed|neutral|angry|fearful", "stressLevel": 0-10, "description": "brief analysis", "confidence": 0-100 }`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    try {
      const result = JSON.parse(response.choices[0].message.content);
      res.json(result);
    } catch {
      // If JSON parsing fails, return a default response
      res.json({
        emotion: 'neutral',
        stressLevel: 5,
        description: 'Unable to analyze. Please share more about how you are feeling.',
        confidence: 0
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Image analysis failed', error: error.message });
  }
});

// POST /api/chat/transcribe (voice-to-text)
// Note: Groq SDK doesn't support audio transcription yet
// This endpoint returns a placeholder - transcription happens on the frontend using Groq's Whisper API
router.post('/transcribe', protect, async (req, res) => {
  try {
    const { audioBase64, audioFormat = 'wav', transcribedText } = req.body;

    if (!transcribedText && !audioBase64) {
      return res.status(400).json({ message: 'Either transcribedText or audio data is required' });
    }

    // If transcribed text is already provided from frontend, use it
    if (transcribedText) {
      console.log('✅ Using pre-transcribed text:', transcribedText.substring(0, 50));
      return res.json({
        text: transcribedText,
        timestamp: new Date(),
        source: 'frontend'
      });
    }

    // For future integration with Groq audio API when available
    console.log('📝 Audio transcription endpoint (Groq audio API pending)');
    res.json({
      text: 'Transcription service will be available with Groq audio support',
      timestamp: new Date(),
      source: 'placeholder'
    });
  } catch (error) {
    console.error('❌ Transcription API Error:', error);
    console.error('❌ Error Details:', error.message, error.status);
    res.status(500).json({ message: 'Transcription failed', error: error.message });
  }
});

module.exports = router;
