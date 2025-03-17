import React from "react";
import { Link } from "react-router-dom";
import "../styles/LandingPage.css"; // ✅ Fixed double slash issue

interface Highlight {
  id: number;
  name: string;
  detail: string;
}

const sampleHighlights: Highlight[] = [
  { id: 1, name: "Mona Lisa", detail: "Oil Painter" },
  { id: 2, name: "Da Vinci", detail: "Visionary Inventor" },
  { id: 3, name: "Frida Kahlo", detail: "Surrealist Master" },
];

const LandingPage: React.FC = () => {
  return (
    <div className="abstract-landing">
      {/* Hero / Header */}
      <header className="abstract-hero">
        <div className="abstract-overlay"></div>
        <div className="abstract-hero-content">
          <h1 className="abstract-title">ARTEPOVERA</h1>
          <p className="abstract-subtitle">
            Where imagination meets opportunity. 
            <br />
            Join our creative world—<em>today</em>.
          </p>
          <div className="abstract-cta">
            <Link to="/login" className="abstract-button">Log In</Link>
            <Link to="/register" className="abstract-button alt">Sign Up</Link>
          </div>
        </div>
      </header>

      {/* Artistic Teaser Section */}
      <section className="abstract-section highlight-section">
        <h2 className="abstract-heading">A Stage for Every Artist</h2>
        <p className="abstract-paragraph">
          Dancers, painters, sculptors, digital creators—anyone can find 
          the perfect opportunity here. Some of our shining stars:
        </p>
        <div className="abstract-highlight-list">
          {sampleHighlights.map(item => (
            <div key={item.id} className="abstract-highlight-card">
              <h3>{item.name}</h3>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="abstract-section abstract-footer">
        <h2>Ready to Make Your Mark?</h2>
        <p>
          Employers seeking raw talent. Artists craving new horizons. 
          Let your creativity spark a revolution.
        </p>
        <Link to="/register" className="abstract-button large">Join Us</Link>
      </section>
    </div>
  );
};

export default LandingPage;
