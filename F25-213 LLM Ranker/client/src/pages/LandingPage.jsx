import { Link, useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { useAuth } from "../contexts/AuthContext"
import { Button } from "../components/ui/button"
import { 
  Sparkles, 
  BarChart3, 
  Search, 
  History, 
  Zap, 
  Shield,
  ArrowRight,
  CheckCircle2
} from "lucide-react"

const LandingPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      navigate("/home", { replace: true })
    }
  }, [user, navigate])
  return (
    <div className="landing-page-container">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-content">
          <Link to="/" className="landing-logo-link">
            <h1 className="landing-logo">LLM RANKER</h1>
          </Link>
          <div className="landing-nav-actions">
            <Link to="/login">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <Sparkles className="w-4 h-4" />
            <span>Compare & Rank AI Models</span>
          </div>
          <h1 className="landing-hero-title">
            Find the Best LLM for Your Needs
          </h1>
          <p className="landing-hero-description">
            Compare responses from multiple Large Language Models side-by-side. 
            Get ranked results, analyze performance, and choose the perfect AI model 
            for your specific use case.
          </p>
          <div className="landing-hero-cta">
            <Link to="/register">
              <Button size="lg" className="landing-cta-primary">
                Start Ranking Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="landing-cta-secondary">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-features">
        <div className="landing-section-content">
          <h2 className="landing-section-title">Why Choose LLM RANKER?</h2>
          <p className="landing-section-subtitle">
            Everything you need to make informed decisions about AI models
          </p>
          
          <div className="landing-features-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="landing-feature-title">Multi-Model Comparison</h3>
              <p className="landing-feature-description">
                Submit your query once and get responses from multiple LLMs including 
                ChatGPT, Claude, Gemini, and many more. Compare them side-by-side instantly.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h3 className="landing-feature-title">Smart Ranking System</h3>
              <p className="landing-feature-description">
                Get automatic rankings based on response quality. Customize rankings 
                by dragging and dropping to match your preferences. Save your preferred order.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <History className="w-8 h-8" />
              </div>
              <h3 className="landing-feature-title">Query History</h3>
              <p className="landing-feature-description">
                Access your complete query history. Review past comparisons, 
                see which models performed best, and track your ranking preferences over time.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="landing-feature-title">Fast & Efficient</h3>
              <p className="landing-feature-description">
                Get results quickly with our optimized comparison engine. 
                Select specific models to compare or use all available models for comprehensive analysis.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <Shield className="w-8 h-8" />
              </div>
              <h3 className="landing-feature-title">Detailed Analysis</h3>
              <p className="landing-feature-description">
                View full responses from each model. Filter and sort by rank, 
                score, or model name. Get comprehensive insights to make better decisions.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="landing-feature-title">Easy to Use</h3>
              <p className="landing-feature-description">
                Intuitive interface designed for both beginners and experts. 
                No technical knowledge required. Start comparing models in seconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="landing-how-it-works">
        <div className="landing-section-content">
          <h2 className="landing-section-title">How It Works</h2>
          <p className="landing-section-subtitle">
            Get started in three simple steps
          </p>

          <div className="landing-steps">
            <div className="landing-step">
              <div className="landing-step-number">1</div>
              <h3 className="landing-step-title">Select AI Models</h3>
              <p className="landing-step-description">
                Choose from 29+ available LLMs including ChatGPT, Claude, Gemini, 
                Copilot, and many more. Select all or pick specific models to compare.
              </p>
            </div>

            <div className="landing-step">
              <div className="landing-step-number">2</div>
              <h3 className="landing-step-title">Submit Your Query</h3>
              <p className="landing-step-description">
                Enter your question or prompt. Our system will send it to all 
                selected models and collect their responses simultaneously.
              </p>
            </div>

            <div className="landing-step">
              <div className="landing-step-number">3</div>
              <h3 className="landing-step-title">Compare & Rank</h3>
              <p className="landing-step-description">
                Review all responses side-by-side. See automatic rankings, 
                customize the order, and save your preferences for future reference.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-cta-section">
        <div className="landing-cta-content">
          <h2 className="landing-cta-title">Ready to Find Your Perfect LLM?</h2>
          <p className="landing-cta-description">
            Join thousands of users who are making smarter AI decisions with LLM RANKER
          </p>
          <div className="landing-cta-buttons">
            <Link to="/register">
              <Button size="lg" className="landing-cta-primary">
                Create Free Account
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="landing-cta-secondary-white">
                Sign In to Existing Account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <p className="landing-footer-text">
            © 2024 LLM RANKER. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage

