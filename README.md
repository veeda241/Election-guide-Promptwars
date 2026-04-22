# Election Guide

Election Guide is an interactive civic education app with a Python Flask backend and a React frontend. It includes election timelines, a step-by-step guide, a quiz, calendar planning, and an AI assistant for civic questions.

## Stack

- Backend: Python 3.11, Flask, optional Google Calendar and Anthropic integrations
- Frontend: React 18, Vite
- Production: Flask serves the built React app from `dist/`

## Run Locally

1. Install frontend dependencies:

```bash
npm install
```

2. Install backend dependencies:

```bash
python -m pip install -r backend/requirements.txt
```

3. Copy the example environment file:

```bash
copy .env.example .env
```

4. Start both servers:

```bash
npm start
```

On Windows, the root start script uses the repo virtualenv at `.venv\Scripts\python.exe`, then launches the React dev server alongside Flask.

Open `http://localhost:5173` for the React app. The frontend proxies API calls to `http://localhost:8000`.

## Production Build

```bash
npm run build
python backend/main.py
```

When `dist/` exists, Flask serves the compiled React app.

## Alternate Commands

- `npm run backend` starts Flask only.
- `npm run dev` starts both servers, same as `npm start`.

## Docker

Build and run the combined production image:

```bash
docker build -t election-guide .
docker run -p 8000:8000 --env-file .env election-guide
```

## Environment Variables

See [.env.example](.env.example) for the full list of settings.
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
