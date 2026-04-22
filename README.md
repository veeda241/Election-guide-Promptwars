# 🗳️ Election Guide — Interactive Civic Education Assistant

A production-ready web application for civic education, featuring interactive timelines, educational modules, quizzes, and seamless Google Calendar integration. Built with Node.js/Express backend and vanilla JavaScript frontend.

**Built for: Google PromptWars Hackathon**  
**Status: ✅ Production Ready**

## ✨ Features

- **📅 Timeline View** — Explore election phases across 3 election types (General, Primary, Local)
- **🔄 How It Works** — Learn 8 key steps of the democratic process with checklists
- **🧠 Quiz Yourself** — Test your civic knowledge with 6+ interactive questions
- **📆 Google Calendar Sync** — Add election dates directly to your Google Calendar with one click
- **🤖 AI Assistant** — Get detailed explanations powered by Claude AI (Anthropic)
- **♿ Accessibility** — WCAG AA compliant with full keyboard navigation and screen reader support
- **🔒 Secure Authentication** — Google OAuth 2.0 integration for user login
- **📱 Responsive Design** — Mobile-first design that works on all devices

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn
- Google Cloud account with OAuth 2.0 credentials
- Claude API key from Anthropic

### Installation

1. **Clone and navigate to the project:**

```bash
cd Election-guide-Promptwars
```

2. **Install dependencies:**

```bash
npm install
```

3. **Set up environment variables:**

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

4. **Configure Google OAuth 2.0:**

- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project: "Election Guide"
- Enable the **Google Calendar API**
- Create OAuth 2.0 credentials (Web application):
  - Authorized JavaScript origins: `http://localhost:3000`
  - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
- Copy `Client ID` and `Client Secret` to your `.env` file

5. **Add Claude API key:**

- Go to [Anthropic Console](https://console.anthropic.com/)
- Copy your API key to the `ANTHROPIC_API_KEY` in `.env`

6. **Update `.env` with your values:**

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
ANTHROPIC_API_KEY=sk-ant-your-key-here
SESSION_SECRET=your-secret-key-change-in-production
```

7. **Start the server:**

```bash
npm start
```

8. **Open in browser:**

Visit `http://localhost:3000` and sign in with Google

## 📚 Project Structure

```
Election-guide-Promptwars/
├── server.js                 # Express backend with OAuth & Calendar integration
├── package.json              # Dependencies and scripts
├── .env.example              # Environment variables template
├── public/
│   ├── index.html            # Login/landing page
│   └── app.html              # Main dashboard (after authentication)
└── README.md                 # This file
```

## 🔑 API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /auth/google` | GET | Start Google OAuth flow |
| `GET /auth/google/callback` | GET | OAuth callback (automatic) |
| `GET /api/auth/user` | GET | Get current user info |
| `POST /api/auth/logout` | POST | Logout current user |

### Google Calendar

| Endpoint | Method | Description | Body |
|----------|--------|-------------|------|
| `POST /api/calendar/add-event` | POST | Add single event to calendar | `{ title, date, description }` |
| `POST /api/calendar/add-events` | POST | Add multiple events to calendar | `{ events: [{ title, date, description }] }` |

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/calendar/add-event \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Election Day",
    "date": "2024-11-05",
    "description": "Cast your vote"
  }'
```

### AI Assistant

| Endpoint | Method | Description | Body |
|----------|--------|-------------|------|
| `POST /api/ai/prompt` | POST | Send prompt to Claude AI | `{ prompt: "Your question here" }` |

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/ai/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain the Electoral College"
  }'
```

## 🎨 Frontend Architecture

### Data Constants

- **TIMELINES** — 3 election type timelines with phases
- **STEPS** — 8-step election process guide
- **QUIZ** — 6+ civic knowledge questions
- **CAL_EVENTS** — 6 key election events

### State Management

```javascript
let currentElection = 'general';   // Timeline tab state
let currentStep = 0;                // Steps tab state
let quizIdx = 0;                    // Quiz current question
let quizScore = 0;                  // Quiz score tracker
let checkedEvents = new Set([0,2,4]); // Calendar selections
```

### Render Functions

- `renderTimeline()` — Build timeline UI from state
- `renderSteps()` — Build steps UI from state
- `renderQuiz()` — Build quiz UI from state
- `renderCalendar()` — Build calendar UI from state
- `switchTab(panelId)` — Switch between tabs and trigger renders

## 🔐 Security Features

✅ **Input Sanitization** — All user inputs passed through `encodeURIComponent()` for URLs  
✅ **No Eval** — No `eval()`, `new Function()`, or dynamic code execution  
✅ **Safe HTML** — HTML entities escaped with `escHtml()` helper  
✅ **Session Security** — HTTPOnly, Secure (in production) session cookies  
✅ **CORS Protected** — CORS enabled but can be restricted to specific origins  
✅ **No Hardcoded Secrets** — All secrets loaded from environment variables  

## ♿ Accessibility

The application follows WCAG 2.1 AA standards:

- ✅ Full keyboard navigation (Tab, Enter, Space)
- ✅ ARIA roles and labels on all interactive elements
- ✅ Live regions for dynamic content updates
- ✅ Screen reader text and semantic HTML
- ✅ Color contrast ratios meeting 4.5:1 standard
- ✅ Visible focus indicators

### ARIA Attributes

- `role="tablist"` / `role="tab"` — Tab navigation
- `role="listitem"` — Timeline and step items
- `role="group"` — Grouped controls
- `aria-live="polite"` — Non-urgent updates
- `aria-live="assertive"` — Quiz feedback
- `aria-expanded` — Accordion states
- `aria-selected` — Tab states
- `aria-pressed` — Button states

## 📦 Deployment

### Heroku

1. Create a Heroku app:

```bash
heroku create election-guide-app
```

2. Add environment variables:

```bash
heroku config:set GOOGLE_CLIENT_ID=your-id
heroku config:set GOOGLE_CLIENT_SECRET=your-secret
heroku config:set ANTHROPIC_API_KEY=sk-ant-your-key
heroku config:set SESSION_SECRET=your-secret
heroku config:set BASE_URL=https://election-guide-app.herokuapp.com
```

3. Update Google OAuth redirect URI to your Heroku domain

4. Deploy:

```bash
git push heroku main
```

### Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t election-guide .
docker run -p 3000:3000 --env-file .env election-guide
```

### Environment Variables (Production)

```env
NODE_ENV=production
PORT=3000
BASE_URL=https://yourdomain.com
SESSION_SECRET=generate-a-strong-random-string
GOOGLE_CLIENT_ID=your-production-client-id
GOOGLE_CLIENT_SECRET=your-production-secret
ANTHROPIC_API_KEY=sk-ant-production-key
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
```

## 🧪 Testing

### Manual Test Checklist

#### Timeline Tab

- [ ] All 3 election types switch correctly
- [ ] Timeline items expand/collapse on click
- [ ] Only one item open at a time
- [ ] Status badges show: Completed, Now, Upcoming
- [ ] "Learn more" fires AI prompt
- [ ] "Add to Calendar" opens single event add

#### How It Works Tab

- [ ] All 8 steps render
- [ ] Clicking a step selects it
- [ ] Detail panel shows for selected step
- [ ] Checklists display correctly
- [ ] "Explain in detail" fires AI prompt

#### Quiz Tab

- [ ] Progress bar updates
- [ ] Questions display correctly
- [ ] Correct answer highlights green
- [ ] Wrong answer highlights red
- [ ] Score increments correctly
- [ ] Final screen shows score
- [ ] "Restart" resets all state

#### Calendar Tab

- [ ] All 6 events render
- [ ] Checkboxes toggle correctly
- [ ] Events 0, 2, 4 pre-checked by default
- [ ] "Add to Calendar" opens multiple tabs
- [ ] Status message shows count of added events
- [ ] Error message shows if no events selected

#### Authentication

- [ ] Google login flow works
- [ ] User info displays in navbar
- [ ] Logout clears session and redirects
- [ ] Unauthenticated users see landing page

## 📝 Code Quality

- ✅ **Separation of Concerns** — Data, render, and event handlers are separate
- ✅ **DRY Principle** — No code duplication; helper functions for common tasks
- ✅ **Named Functions** — All functions are named (no anonymous function soup)
- ✅ **Consistent Naming** — `render*()` for UI builders, `btn-*` for CSS classes
- ✅ **Pure Rendering** — Render functions rebuild from data, not partial DOM patches
- ✅ **CSS Organization** — CSS custom properties for theming, component prefixes for scoping

## 🚀 Performance

- **Zero Dependencies in Frontend** — Vanilla HTML/CSS/JS, no frameworks
- **CSS Transitions** — All animations use GPU-accelerated CSS, not JavaScript
- **No Layout Thrashing** — Minimal DOM writes and reads
- **Efficient Event Delegation** — Event listeners on container elements where possible
- **Session-based Auth** — No token juggling, secure HTTPOnly cookies

## 📞 Support

For issues or questions:

1. Check the `.env.example` file for required variables
2. Ensure Google OAuth credentials are valid
3. Verify Claude API key is active
4. Check browser console for errors
5. Review server logs for API errors

## 📄 License

MIT — Feel free to use, modify, and distribute

## 🙏 Acknowledgments

- Built for **Google PromptWars** hackathon
- Powered by **Claude AI** (Anthropic)
- Integrated with **Google Calendar API**
- Accessible design following **WCAG 2.1 AA** standards

---

**🗳️ Election Guide — Making Civic Education Interactive and Accessible**
