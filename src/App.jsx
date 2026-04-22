import { useEffect, useMemo, useState } from 'react';
import content from '../content.json';

const API_ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const DEFAULT_PROMPT = 'Ask about any election phase, voting step, or deadline.';

const MONTH_TO_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function apiUrl(path) {
  return `${API_ROOT}${path}`;
}

async function requestJson(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

function getInitials(name) {
  if (!name) {
    return 'EG';
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2);
}

function formatLongDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function parseTimelineDate(label) {
  if (!label) {
    return null;
  }

  const yearMatch = label.match(/(20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : 2024;
  const monthMatch = label.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\b/i);

  if (!monthMatch) {
    return null;
  }

  const monthKey = monthMatch[1].slice(0, 4).toLowerCase();
  const monthIndex = MONTH_TO_INDEX[monthKey] ?? MONTH_TO_INDEX[monthMatch[1].slice(0, 3).toLowerCase()];

  if (monthIndex == null) {
    return null;
  }

  const dayMatch = label.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})/i);
  const day = dayMatch ? Number(dayMatch[1]) : 1;
  const parsed = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function statusLabel(status) {
  if (status === 'done') {
    return 'Completed';
  }

  if (status === 'current') {
    return 'Now';
  }

  return 'Upcoming';
}

function timelineStatusTone(status) {
  if (status === 'done') {
    return 'tone-done';
  }

  if (status === 'current') {
    return 'tone-current';
  }

  return 'tone-upcoming';
}

function App() {
  const [bootstrap, setBootstrap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [authForm, setAuthForm] = useState({ name: '', email: '' });

  const refreshBootstrap = async () => {
    try {
      const data = await requestJson('/api/bootstrap', { method: 'GET' });
      setBootstrap(data);
      setLoadError('');
    } catch (error) {
      setBootstrap({ authenticated: false, user: null, integrations: { googleAuthEnabled: false, aiEnabled: false } });
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshBootstrap();
  }, []);

  const integrations = bootstrap?.integrations || { googleAuthEnabled: false, aiEnabled: false };
  const user = bootstrap?.user || null;

  const handleDemoLogin = async (event) => {
    event.preventDefault();

    try {
      await requestJson('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({
          name: authForm.name.trim(),
          email: authForm.email.trim(),
        }),
      });
      await refreshBootstrap();
    } catch (error) {
      setLoadError(error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await requestJson('/api/auth/logout', { method: 'POST' });
      await refreshBootstrap();
    } catch (error) {
      setLoadError(error.message);
    }
  };

  const handleGoogleLogin = () => {
    window.location.assign(apiUrl('/auth/google'));
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!bootstrap?.authenticated) {
    return (
      <LandingScreen
        content={content}
        integrations={integrations}
        form={authForm}
        error={loadError}
        onFormChange={setAuthForm}
        onDemoLogin={handleDemoLogin}
        onGoogleLogin={handleGoogleLogin}
      />
    );
  }

  return (
    <Dashboard
      content={content}
      integrations={integrations}
      user={user}
      onLogout={handleLogout}
    />
  );
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-card card glass">
        <div className="brand-lockup">
          <span className="brand-mark">EG</span>
          <div>
            <p className="eyebrow">Loading Election Guide</p>
            <h1>Preparing the civic workspace</h1>
          </div>
        </div>
        <div className="loading-bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}

function LandingScreen({ content, integrations, form, error, onFormChange, onDemoLogin, onGoogleLogin }) {
  const stats = useMemo(
    () => [
      { label: 'Election tracks', value: Object.keys(content.timelines || {}).length },
      { label: 'Guide steps', value: content.steps.length },
      { label: 'Quiz questions', value: content.quiz.length },
      { label: 'Calendar dates', value: content.calendarEvents.length },
    ],
    [content]
  );

  const features = content.features || [];

  return (
    <div className="page-shell auth-shell">
      <div className="hero-panel card glass hero-grid">
        <div className="hero-copy">
          <div className="hero-badge">{content.brand.eyebrow}</div>
          <h1 className="hero-title">{content.brand.name}</h1>
          <p className="hero-tagline">{content.brand.tagline}</p>
          <p className="hero-summary">{content.brand.summary}</p>

          <div className="stat-strip" aria-label="Product summary">
            {stats.map((stat) => (
              <div className="stat-card" key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>

          <form className="auth-form card" onSubmit={onDemoLogin}>
            <div className="form-grid">
              <label>
                <span>Name</span>
                <input
                  type="text"
                  value={form.name}
                  placeholder="Guest Explorer"
                  onChange={(event) => onFormChange((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  placeholder="guest@example.com"
                  onChange={(event) => onFormChange((current) => ({ ...current, email: event.target.value }))}
                />
              </label>
            </div>

            <div className="auth-actions">
              <button type="submit" className="button button-primary">
                Enter demo workspace
              </button>
              <button type="button" className="button button-secondary" onClick={onGoogleLogin} disabled={!integrations.googleAuthEnabled}>
                {integrations.googleAuthEnabled ? 'Connect Google account' : 'Google OAuth unavailable'}
              </button>
            </div>

            {error ? <p className="inline-error">{error}</p> : <p className="inline-note">Demo mode works even when external credentials are not configured.</p>}
          </form>
        </div>

        <aside className="hero-side card">
          <div className="side-heading">
            <p className="eyebrow">What is included</p>
            <h2>Everything needed to understand the election cycle</h2>
          </div>

          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-mark">{feature.title.slice(0, 2).toUpperCase()}</div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </article>
            ))}
          </div>

          <div className="integration-strip">
            <span className={integrations.googleAuthEnabled ? 'pill pill-on' : 'pill'}>Google auth {integrations.googleAuthEnabled ? 'enabled' : 'optional'}</span>
            <span className={integrations.aiEnabled ? 'pill pill-on' : 'pill'}>AI assistant {integrations.aiEnabled ? 'enabled' : 'offline fallback'}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Dashboard({ content, integrations, user, onLogout }) {
  const [activeTab, setActiveTab] = useState('timeline');
  const [assistantPrompt, setAssistantPrompt] = useState(DEFAULT_PROMPT);
  const [assistantState, setAssistantState] = useState({
    loading: false,
    response: 'Use the prompts below to ask the civic assistant about elections, voting, or deadlines.',
    source: 'idle',
    error: '',
  });

  const askAssistant = async (prompt) => {
    const nextPrompt = prompt.trim();

    if (!nextPrompt) {
      return;
    }

    setAssistantPrompt(nextPrompt);
    setAssistantState((current) => ({ ...current, loading: true, error: '' }));

    try {
      const data = await requestJson('/api/ai/prompt', {
        method: 'POST',
        body: JSON.stringify({ prompt: nextPrompt }),
      });

      setAssistantState({
        loading: false,
        response: data.response,
        source: data.source || 'fallback',
        error: '',
      });
    } catch (error) {
      setAssistantState({
        loading: false,
        response: '',
        source: 'error',
        error: error.message,
      });
    }
  };

  const handleSingleCalendar = async (event) => requestJson('/api/calendar/add-event', {
    method: 'POST',
    body: JSON.stringify(event),
  });

  const handleBatchCalendar = async (events) => requestJson('/api/calendar/add-events', {
    method: 'POST',
    body: JSON.stringify({ events }),
  });

  const stats = useMemo(
    () => [
      { label: 'Mode', value: user.provider === 'google' ? 'Google' : 'Demo' },
      { label: 'AI', value: integrations.aiEnabled ? 'Online' : 'Fallback' },
      { label: 'Tracks', value: Object.keys(content.timelines).length },
      { label: 'Events', value: content.calendarEvents.length },
    ],
    [content.calendarEvents.length, content.timelines, integrations.aiEnabled, user.provider]
  );

  return (
    <div className="page-shell dashboard-shell">
      <header className="topbar card glass">
        <div className="brand-lockup">
          <span className="brand-mark">EG</span>
          <div>
            <p className="eyebrow">Election Guide</p>
            <h1>{content.brand.tagline}</h1>
          </div>
        </div>

        <div className="topbar-side">
          <div className="user-chip">
            <span className="user-avatar">{getInitials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <span>{user.email || user.provider || 'Guest'}</span>
            </div>
          </div>
          <button className="button button-secondary small" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <section className="overview-row">
        {stats.map((stat) => (
          <article className="overview-card card glass" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <main className="main-column card glass">
          <TabBar activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'timeline' && (
            <TimelineTab
              timelines={content.timelines}
              onAsk={askAssistant}
              onCalendar={handleSingleCalendar}
            />
          )}

          {activeTab === 'steps' && <StepsTab steps={content.steps} onAsk={askAssistant} />}

          {activeTab === 'quiz' && <QuizTab quiz={content.quiz} onAsk={askAssistant} />}

          {activeTab === 'calendar' && (
            <CalendarTab events={content.calendarEvents} onCalendar={handleBatchCalendar} />
          )}
        </main>

        <aside className="assistant-column card glass">
          <AssistantPanel
            prompt={assistantPrompt}
            setPrompt={setAssistantPrompt}
            state={assistantState}
            onSubmit={askAssistant}
          />
        </aside>
      </div>
    </div>
  );
}

function TabBar({ activeTab, onChange }) {
  const tabs = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'steps', label: 'How It Works' },
    { id: 'quiz', label: 'Quiz' },
    { id: 'calendar', label: 'Calendar' },
  ];

  return (
    <nav className="tab-bar" role="tablist" aria-label="Election guide sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeTab === tab.id ? 'tab-button active' : 'tab-button'}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function TimelineTab({ timelines, onAsk, onCalendar }) {
  const [selectedTrack, setSelectedTrack] = useState('general');
  const [openIndex, setOpenIndex] = useState(0);
  const [status, setStatus] = useState('');
  const [calendarLink, setCalendarLink] = useState('');

  const items = timelines[selectedTrack] || [];

  useEffect(() => {
    setOpenIndex(0);
    setStatus('');
    setCalendarLink('');
  }, [selectedTrack]);

  const handleAsk = (item) => {
    onAsk(`Tell me more about the "${item.title}" phase of the election process.`);
  };

  const handleCalendar = async (item) => {
    const parsedDate = parseTimelineDate(item.date);

    if (!parsedDate) {
      setStatus('This milestone does not have a clean calendar date.');
      setCalendarLink('');
      return;
    }

    setStatus('Syncing event...');
    setCalendarLink('');

    try {
      const data = await onCalendar({ title: item.title, date: parsedDate, description: item.desc });
      setStatus(data.mode === 'google' ? 'Event added to Google Calendar.' : 'Calendar template ready.');
      setCalendarLink(data.eventLink || '');
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <section className="tab-panel timeline-panel">
      <div className="track-switcher">
        {Object.keys(timelines).map((track) => (
          <button
            type="button"
            key={track}
            className={selectedTrack === track ? 'track-pill active' : 'track-pill'}
            onClick={() => setSelectedTrack(track)}
          >
            {track === 'general' ? 'General' : track === 'primary' ? 'Primary' : 'Local'}
          </button>
        ))}
      </div>

      <div className="accordion-list">
        {items.map((item, index) => {
          const isOpen = index === openIndex;
          const tone = timelineStatusTone(item.status);

          return (
            <article className={isOpen ? 'timeline-item open' : 'timeline-item'} key={`${item.title}-${index}`}>
              <button
                type="button"
                className="timeline-header"
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
              >
                <span className={`timeline-dot ${tone}`} aria-hidden="true" />
                <span className="timeline-meta">
                  <strong>{item.title}</strong>
                  <span>{item.date}</span>
                </span>
                <span className={`status-pill ${tone}`}>{statusLabel(item.status)}</span>
                <span className="chevron" aria-hidden="true">▾</span>
              </button>

              <div className="timeline-body">
                <p>{item.desc}</p>
                <div className="button-row">
                  <button type="button" className="button button-primary small" onClick={() => handleAsk(item)}>
                    Explain this phase
                  </button>
                  <button type="button" className="button button-secondary small" onClick={() => handleCalendar(item)}>
                    Add to calendar
                  </button>
                </div>
                {calendarLink ? (
                  <a className="calendar-link" href={calendarLink} target="_blank" rel="noreferrer">
                    Open calendar event
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {status ? <p className="status-message">{status}</p> : null}
    </section>
  );
}

function StepsTab({ steps, onAsk }) {
  const [selectedStep, setSelectedStep] = useState(0);

  const step = steps[selectedStep];

  return (
    <section className="tab-panel steps-panel">
      <div className="step-grid">
        {steps.map((item, index) => (
          <button
            key={item.name}
            type="button"
            className={index === selectedStep ? 'step-card active' : 'step-card'}
            onClick={() => setSelectedStep(index)}
          >
            <span className="step-num">{item.num}</span>
            <span className="step-short">{item.short}</span>
          </button>
        ))}
      </div>

      <article className="detail-card">
        <p className="eyebrow">Step {step.num}</p>
        <h2>{step.name}</h2>
        <p className="detail-copy">{step.detail}</p>

        <ul className="checklist">
          {step.checklist.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <button
          type="button"
          className="button button-primary small"
          onClick={() => onAsk(`Explain in detail: "${step.name}". What happens during this phase of the election process?`)}
        >
          Explain in detail
        </button>
      </article>
    </section>
  );
}

function QuizTab({ quiz, onAsk }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState('');

  const current = quiz[questionIndex];
  const finished = questionIndex >= quiz.length;

  const progress = Math.round((questionIndex / quiz.length) * 100);

  const handleAnswer = (index) => {
    if (locked) {
      return;
    }

    const isCorrect = index === current.correct;
    setSelectedAnswer(index);
    setLocked(true);
    setFeedback(`${isCorrect ? 'Correct.' : 'Not quite.'} ${current.explain}`);

    if (isCorrect) {
      setScore((currentScore) => currentScore + 1);
    }
  };

  const nextQuestion = () => {
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    setSelectedAnswer(null);
    setLocked(false);
    setFeedback('');
  };

  const restart = () => {
    setQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setLocked(false);
    setFeedback('');
  };

  if (finished) {
    const percentage = Math.round((score / quiz.length) * 100);
    const message =
      percentage === 100
        ? 'Perfect score. You know the election process very well.'
        : percentage >= 66
          ? 'Strong result. You have a solid civic foundation.'
          : percentage >= 33
            ? 'Good effort. Keep learning and reviewing the process.'
            : 'Every voter starts somewhere. Keep building your civic knowledge.';

    return (
      <section className="tab-panel quiz-panel">
        <article className="result-card">
          <p className="eyebrow">Quiz complete</p>
          <h2>{score}/{quiz.length}</h2>
          <p className="detail-copy">{message}</p>

          <div className="button-row center-row">
            <button type="button" className="button button-primary small" onClick={() => onAsk('Create five more civic education quiz questions about voting and elections.') }>
              Ask for more questions
            </button>
            <button type="button" className="button button-secondary small" onClick={restart}>
              Restart quiz
            </button>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="tab-panel quiz-panel">
      <div className="quiz-meter" aria-label="Quiz progress">
        <div className="quiz-meter-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="quiz-pips" aria-label="Question progress">
        {quiz.map((_, index) => {
          const tone = index < questionIndex ? 'done' : index === questionIndex ? 'current' : '';
          return (
            <span className={`quiz-pip ${tone}`} key={`pip-${index}`}>
              {index + 1}
            </span>
          );
        })}
      </div>

      <article className="quiz-card">
        <div className="quiz-card-top">
          <span className="eyebrow">Question {questionIndex + 1} of {quiz.length}</span>
          <span className="score-chip">Score {score}/{questionIndex}</span>
        </div>

        <h2>{current.q}</h2>

        <div className="option-list" role="group" aria-label="Quiz answers">
          {current.opts.map((option, index) => {
            const isCorrect = index === current.correct;
            const isSelected = index === selectedAnswer;
            let optionClass = 'option-button';

            if (locked && isCorrect) {
              optionClass += ' correct';
            } else if (locked && isSelected && !isCorrect) {
              optionClass += ' wrong';
            }

            return (
              <button
                key={option}
                type="button"
                className={optionClass}
                onClick={() => handleAnswer(index)}
                disabled={locked}
              >
                {option}
              </button>
            );
          })}
        </div>

        <p className="feedback" role="status" aria-live="polite">
          {feedback}
        </p>

        <div className="button-row">
          <span />
          <button type="button" className="button button-primary small" onClick={nextQuestion} disabled={!locked}>
            Next question
          </button>
        </div>
      </article>
    </section>
  );
}

function CalendarTab({ events, onCalendar }) {
  const defaultSelection = useMemo(() => new Set([0, 2, 4]), [events]);
  const [selected, setSelected] = useState(defaultSelection);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  const toggle = (index) => {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }

      return next;
    });
  };

  const addSelected = async () => {
    if (selected.size === 0) {
      setStatus('Select at least one event first.');
      return;
    }

    setBusy(true);
    setStatus('Adding selected events...');
    setResults([]);

    try {
      const payload = [...selected]
        .sort((left, right) => left - right)
        .map((index) => ({
          title: events[index].name,
          date: events[index].date,
          description: events[index].desc,
        }));

      const data = await onCalendar(payload);
      setStatus(`Added ${data.addedCount} event${data.addedCount === 1 ? '' : 's'} to the calendar.`);
      setResults(data.results || []);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tab-panel calendar-panel">
      <p className="detail-copy">Choose the dates you want to track, then export them to Google Calendar or open the ready-made template links.</p>

      <div className="calendar-list">
        {events.map((event, index) => {
          const checked = selected.has(index);

          return (
            <button
              type="button"
              key={event.name}
              className={checked ? 'calendar-row active' : 'calendar-row'}
              onClick={() => toggle(index)}
            >
              <span className="calendar-check" aria-hidden="true" />
              <span className="calendar-meta">
                <strong>{event.name}</strong>
                <span>{formatLongDate(event.date)}</span>
              </span>
              <span className={`type-pill type-${event.type}`}>{event.type}</span>
            </button>
          );
        })}
      </div>

      <div className="button-row">
        <button type="button" className="button button-primary" onClick={addSelected} disabled={busy}>
          {busy ? 'Adding...' : 'Add selected events'}
        </button>
        <span className="status-message">{status}</span>
      </div>

      {results.length > 0 ? (
        <div className="calendar-results card">
          <h3>Calendar links</h3>
          <div className="calendar-link-list">
            {results.map((result, index) => (
              <a key={`${result.title}-${index}`} className="calendar-link" href={result.eventLink} target="_blank" rel="noreferrer">
                Open {result.title}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AssistantPanel({ prompt, setPrompt, state, onSubmit }) {
  const suggestions = [
    'Explain the Electoral College in plain language.',
    'Summarize the primary election process.',
    'What should I remember before Election Day?',
  ];

  return (
    <section className="assistant-panel">
      <div className="assistant-head">
        <p className="eyebrow">Civic assistant</p>
        <h2>Ask a question</h2>
      </div>

      <div className="suggestion-list">
        {suggestions.map((item) => (
          <button key={item} type="button" className="suggestion-pill" onClick={() => onSubmit(item)}>
            {item}
          </button>
        ))}
      </div>

      <label className="prompt-field">
        <span>Your prompt</span>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} />
      </label>

      <button type="button" className="button button-primary" onClick={() => onSubmit(prompt)} disabled={state.loading}>
        {state.loading ? 'Thinking...' : 'Ask assistant'}
      </button>

      {state.error ? <p className="inline-error">{state.error}</p> : null}

      <article className="assistant-response card" aria-live="polite">
        <div className="assistant-response-head">
          <span className={state.source === 'anthropic' ? 'pill pill-on' : 'pill'}>{state.source === 'anthropic' ? 'Anthropic' : 'Offline response'}</span>
        </div>
        <p>{state.response}</p>
      </article>
    </section>
  );
}

export default App;