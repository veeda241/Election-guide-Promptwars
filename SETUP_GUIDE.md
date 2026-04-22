# Election Guide Setup

This repo now uses a Python backend and a React frontend.

## What Runs Where

- Backend: `backend/main.py`
- Frontend: `src/` with Vite
- Shared content: `content.json`

## Local Setup

1. Install the frontend packages:

```bash
npm install
```

2. Install the backend packages:

```bash
python -m pip install -r backend/requirements.txt
```

3. Copy the environment file:

```bash
copy .env.example .env
```

4. Start both servers:

```bash
npm start
```

On Windows, the root start script uses the repo virtualenv at `.venv\Scripts\python.exe` and launches Flask plus Vite together.

The frontend runs on `http://localhost:5173` and proxies API requests to `http://localhost:8000`.

## Optional Integrations

- Google OAuth and Calendar require `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`.
- Anthropic support requires `ANTHROPIC_API_KEY`.

If those keys are missing, the app still works in demo mode and uses a fallback civic assistant response.

## Production

Build the client and run Flask:

```bash
npm run build
python backend/main.py
```

The backend serves the compiled app from `dist/`.

## Alternate Commands

- `npm run backend` starts Flask only.
- `npm run dev` starts both servers, same as `npm start`.

1. ✅ **Install dependencies**: `npm install`
2. ✅ **Set up Google OAuth** in Google Cloud Console
3. ✅ **Get Claude API key** from Anthropic
4. ✅ **Create .env file** with your credentials
5. ✅ **Start server**: `npm start`
6. ✅ **Visit** `http://localhost:3000`
7. ✅ **Sign in** with Google
8. ✅ **Test all features**
9. ✅ **Deploy** to production (Heroku, AWS, GCP, etc.)

---

## 📚 Additional Resources

- [Google Calendar API Docs](https://developers.google.com/calendar/api)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [Express.js Documentation](https://expressjs.com/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## ✨ You're All Set!

Your Election Guide application is ready to go. It includes:

- ✅ Full authentication with Google OAuth
- ✅ Real Google Calendar integration
- ✅ AI-powered educational content via Claude
- ✅ Production-ready code
- ✅ Complete documentation
- ✅ Docker setup for easy deployment
- ✅ WCAG AA accessibility compliance

**Next: Configure your credentials and run `npm start`**

---

Built with ❤️ for the **Google PromptWars** hackathon  
Powered by **Claude AI** • **Google Calendar** • **Node.js**
