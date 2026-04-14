
import { useEffect, useState } from 'react';
import './App.css';
import ChatWidget from './ChatWidget';
import { Menu, X } from 'lucide-react';

const DEMO_API_KEY = 'fc_e63dc534a86b0c301071f519b6e6441e';

function DemoPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      <nav className={`landing-navbar ${isMenuOpen ? 'mobile-menu-active' : ''}`}>
        <div className="landing-logo">
          <div className="landing-logo-dot"></div>
          FynChat
        </div>

        <div className={`landing-nav-links ${isMenuOpen ? 'active' : ''}`}>
          <a href="/#" onClick={() => setIsMenuOpen(false)}>Solutions</a>
          <a href="/#" onClick={() => setIsMenuOpen(false)}>Pricing</a>
          <a href="/#" onClick={() => setIsMenuOpen(false)}>Contact</a>
          <button className="landing-cta mobile-only">Get Started</button>
        </div>

        <div className="landing-nav-actions">
          <button className="landing-cta desktop-only">Get Started</button>
          <button className="mobile-menu-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
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

