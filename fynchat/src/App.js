
import { useEffect, useState } from 'react';
import './App.css';
import ChatWidget from './ChatWidget';

const DEMO_API_KEY = 'fc_4bea250685f9f5090ad344fe9cbdf2c1';

function DemoPage() {
  useEffect(() => {
    // Clear any stale apiKey so this page always stays as demo
    localStorage.removeItem('fynchat_api_key');

    // Inject widget-loader script (React ignores <script> tags in JSX)
    if (document.querySelector('script[data-fynchat]')) return;
    const script = document.createElement('script');
    script.src = 'http://localhost:3000/widget-loader.js';
    script.setAttribute('data-api-key', DEMO_API_KEY);
    script.setAttribute('data-fynchat', 'true');
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="landing-page">
      <nav className="landing-navbar">
        <div className="landing-logo">
          FynChat
        </div>
        <div className="landing-nav-links">
          <a href="/#">Solutions</a>
          <a href="/#">Pricing</a>
          <a href="/#">Contact</a>
        </div>
        <button className="landing-cta" style={{ marginLeft: '20px' }}>Get Started</button>
      </nav>

      <section className="landing-hero">
        <h1>Modern Conversations, Reimagined.</h1>
        <p>
          The next generation chat widget designed for high-end digital experiences.
          Deliver instant support with a premium, monochrome aesthetic.
        </p>
        <button className="landing-cta" style={{ fontSize: '18px', padding: '20px 48px' }}>
          Explore Now
        </button>
      </section>

      <section className="landing-features">
        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <h3>Instant Support</h3>
          <p>Connect with customers in real-time with zero latency and ultra-smooth animations.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🤖</div>
          <h3>Smart Automation</h3>
          <p>Advanced chatbot flows that qualify leads and answer FAQs before reaching agents.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">💎</div>
          <h3>Premium UI</h3>
          <p>State-of-the-art monochrome design that fits perfectly into any high-end SaaS platform.</p>
        </div>
      </section>
    </div>
  );
}

function App({ apiKey }) {
  // Only detect apiKey from URL param or iframe name — NOT localStorage
  // (localStorage gets polluted by widget-loader.js on other pages)
  const [keyToUse] = useState(
    apiKey ||
    new URLSearchParams(window.location.search).get('apiKey') ||
    window.name
  );

  // No apiKey = root demo page: show website with floating chat button
  if (!keyToUse) return <DemoPage />;

  return <ChatWidget apiKey={keyToUse} />;
}

export default App;

