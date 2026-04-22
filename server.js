import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'development-secret-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Google OAuth2 Setup
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${BASE_URL}/auth/google/callback`
);

// Claude API Setup
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/* ═══════════════════════════════════════════════════════════════
   AUTHENTICATION ROUTES
═══════════════════════════════════════════════════════════════ */

// Start Google OAuth flow
app.get('/auth/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });

  res.redirect(url);
});

// Google OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'No authorization code received' });
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Store tokens and user info in session
    req.session.googleTokens = tokens;
    req.session.authenticated = true;

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    req.session.user = {
      id: userInfo.data.id,
      email: userInfo.data.email,
      name: userInfo.data.name,
      picture: userInfo.data.picture,
    };

    res.redirect('/dashboard');
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get current user
app.get('/api/auth/user', (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    user: req.session.user,
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

/* ═══════════════════════════════════════════════════════════════
   GOOGLE CALENDAR ROUTES
═══════════════════════════════════════════════════════════════ */

// Add event to Google Calendar
app.post('/api/calendar/add-event', async (req, res) => {
  try {
    if (!req.session.authenticated || !req.session.googleTokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { title, date, description } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    oauth2Client.setCredentials(req.session.googleTokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Parse date and create event
    const startDateTime = new Date(date + 'T09:00:00');
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 1);

    const event = {
      summary: title,
      description: description || '',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/New_York',
      },
    };

    const result = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.json({
      success: true,
      eventId: result.data.id,
      eventLink: result.data.htmlLink,
    });
  } catch (error) {
    console.error('Calendar error:', error);
    res.status(500).json({ error: 'Failed to add event to calendar' });
  }
});

// Add multiple events to Google Calendar
app.post('/api/calendar/add-events', async (req, res) => {
  try {
    if (!req.session.authenticated || !req.session.googleTokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'No events provided' });
    }

    oauth2Client.setCredentials(req.session.googleTokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const results = [];

    for (const event of events) {
      try {
        const startDateTime = new Date(event.date + 'T09:00:00');
        const endDateTime = new Date(startDateTime);
        endDateTime.setHours(endDateTime.getHours() + 1);

        const calEvent = {
          summary: event.title,
          description: event.description || '',
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: 'America/New_York',
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: 'America/New_York',
          },
        };

        const result = await calendar.events.insert({
          calendarId: 'primary',
          resource: calEvent,
        });

        results.push({
          success: true,
          title: event.title,
          eventId: result.data.id,
          eventLink: result.data.htmlLink,
        });
      } catch (err) {
        results.push({
          success: false,
          title: event.title,
          error: err.message,
        });
      }

      // Rate limiting: wait 100ms between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    res.json({
      success: true,
      results,
      addedCount: results.filter((r) => r.success).length,
    });
  } catch (error) {
    console.error('Batch calendar error:', error);
    res.status(500).json({ error: 'Failed to add events' });
  }
});

/* ═══════════════════════════════════════════════════════════════
   CLAUDE AI ROUTES
═══════════════════════════════════════════════════════════════ */

// Send prompt to Claude AI
app.post('/api/ai/prompt', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res
        .status(500)
        .json({ error: 'Claude API not configured' });
    }

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      system:
        'You are a helpful civic education assistant. Provide clear, accurate, and engaging explanations about the US election process. Keep responses concise and educational.',
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    res.json({
      success: true,
      response: responseText,
    });
  } catch (error) {
    console.error('Claude API error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

/* ═══════════════════════════════════════════════════════════════
   STATIC FILE ROUTES
═══════════════════════════════════════════════════════════════ */

// Dashboard page (after login)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Root (redirect based on auth status)
app.get('/', (req, res) => {
  if (req.session.authenticated) {
    res.redirect('/dashboard');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

/* ═══════════════════════════════════════════════════════════════
   ERROR HANDLING
═══════════════════════════════════════════════════════════════ */

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/* ═══════════════════════════════════════════════════════════════
   START SERVER
═══════════════════════════════════════════════════════════════ */

app.listen(PORT, () => {
  console.log(`🗳  Election Guide server running on ${BASE_URL}`);
  console.log(
    'Endpoints: GET /auth/google | POST /api/calendar/add-events | POST /api/ai/prompt'
  );
});
