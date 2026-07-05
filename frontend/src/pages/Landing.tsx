import { Link } from 'react-router-dom';
import type { MouseEvent } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { FileSearch, MessageSquare, Mic, Shield, ArrowDownRight, Bot, Zap } from 'lucide-react';
import '../styles/landing.css';

const features = [
  {
    icon: FileSearch,
    title: 'ATS Resume Checker',
    desc: 'Upload your resume and a job description — our AI analyzes ATS compatibility, highlights matching keywords, and suggests improvements.',
  },
  {
    icon: MessageSquare,
    title: 'AI Career Chatbot',
    desc: 'Get personalized career advice, cover letter help, and job search strategies from our AI-powered career advisor.',
  },
  {
    icon: Mic,
    title: 'AI Interview Practice',
    desc: 'Practice with AI-generated interview questions tailored to your target role. Get instant feedback on your answers.',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    desc: 'Your data is encrypted and stored securely. We never share your personal information or resumes with third parties.',
  },
  {
    icon: Zap,
    title: 'Portfolio Generator',
    desc: 'Turn your profile into a 1-click single page portfolio website instantly.',
  },
  {
    icon: Bot,
    title: 'Project Finder',
    desc: 'Get AI-recommended side projects that match your exact skillset to build your resume.',
  }
];

const testimonials = [
  {
    quote: "The ATS Checker is magic. It pointed out 5 missing keywords from the job description, and I got an interview the next day.",
    author: "Sarah J.",
    role: "Software Engineer"
  },
  {
    quote: "Practicing with the live AI interviewer helped me get over my nerves. It's like having a FAANG recruiter in your browser.",
    author: "David L.",
    role: "Data Scientist"
  },
  {
    quote: "I generated my portfolio in literally one click and hosted it on GitHub Pages. Easiest web dev I've never done.",
    author: "Elena M.",
    role: "UX Designer"
  }
];

const stats = [
  { value: '10K+', label: 'Resumes Analyzed' },
  { value: '95%', label: 'User Satisfaction' },
  { value: '50+', label: 'Job Categories' },
  { value: '24/7', label: 'AI Availability' },
];

function TiltFeatureCard({ feature, index }: { feature: typeof features[number]; index: number }) {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [4, -4]), { stiffness: 280, damping: 22 });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-4, 4]), { stiffness: 280, damping: 22 });

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <motion.div
      className="feature-card"
      style={{ perspective: 1000 }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      viewport={{ once: true }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="feature-icon">
          <feature.icon size={24} />
        </div>
        <h3>{feature.title}</h3>
        <p>{feature.desc}</p>
      </motion.div>
    </motion.div>
  );
}

export default function Landing() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="landing-page min-h-screen w-full flex flex-col bg-primary text-primary-foreground">
      
      {/* Background Dot Grid */}
      <div className="bg-dots" />

      {/* Hero */}
      <main className="hero flex-1 flex flex-col justify-center pt-40 pb-20 z-10">
        <div className="container mx-auto flex flex-col items-center justify-center gap-6">
          
          {/* Line 1 */}
          <div className="flex flex-wrap items-center justify-center gap-8 relative">
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-right text-text-muted font-bold uppercase tracking-wider text-sm max-w-[220px]"
            >
              Hi, we are Smart Apply. We build practical tools to help you land your dream job.
            </motion.p>
            <div className="relative">
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-6 right-2 z-20"
              >
                <div className="glass-bubble">
                  <FileSearch size={14} />
                  <span>ATS Check</span>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="text-massive text-primary"
              >
                SMART
              </motion.div>
            </div>
          </div>

          {/* Line 2 */}
          <div className="flex items-center justify-center gap-8 relative">
            <div className="relative">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-8 left-4 z-20"
              >
                <div className="glass-bubble">
                  <Mic size={14} />
                  <span>Interview</span>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="text-massive text-primary flex items-center"
              >
                <span>CARE</span>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="mx-2 text-accent"
                >
                  <Bot size={64} />
                </motion.div>
                <span>ER</span>
              </motion.div>
            </div>
          </div>

          {/* Line 3 */}
          <div className="flex flex-wrap items-center justify-center gap-8 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="brutal-badge hide-mobile absolute top-1/4 -right-12"
            >
              <Zap size={14} className="text-accent" />
              <span>Speed</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.2 }}
              className="brutal-badge hide-mobile absolute bottom-1/4 -left-16"
            >
              <Shield size={14} className="text-green-500" />
              <span>Private</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-massive text-primary"
            >
              APPLY
            </motion.div>
            <motion.p
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-left text-text-muted font-bold uppercase tracking-wider text-sm max-w-[200px]"
            >
              Open to students, professionals, and anyone seeking career growth.
            </motion.p>
          </div>
        </div>

        <div className="container mx-auto mt-24">
          <div className="hero-bottom-bar-inner items-center justify-between">
            <div className="flex-1 h-px bg-border hide-mobile" />
            <div className="text-xs font-bold tracking-widest text-text-muted uppercase text-center mx-4">
              ALL-IN-ONE AI PLATFORM — {currentYear}
            </div>
            <Link to="/signup" className="resume-button-group">
              <motion.div className="resume-button">
                <span className="resume-button-text">
                  Get Started
                </span>
                <div className="resume-button-icon">
                  <ArrowDownRight size={20} />
                </div>
              </motion.div>
            </Link>
          </div>
        </div>
      </main>

      {/* Stats */}
      <section className="stats-section" id="stats">
        <div className="stats-grid">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="stat-item"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
            >
              <h3>{stat.value}</h3>
              <p>{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="features-section" id="features">
        <motion.div
          className="section-header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2>Everything You Need to Succeed.</h2>
          <p>
            Powerful AI tools designed to give you an edge in your job search, without the heavy interface.
          </p>
        </motion.div>

        <div className="features-grid">
          {features.map((f, i) => (
            <TiltFeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-bg-secondary py-32 px-6" id="testimonials">
        <div className="container mx-auto">
          <div className="section-header">
            <h2>Wall of Love.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                viewport={{ once: true }}
                className="testimonial-card"
              >
                <div className="text-4xl text-accent mb-4">"</div>
                <p className="text-lg font-medium mb-6 italic text-text-primary flex-1">{t.quote}</p>
                <div>
                  <strong className="block text-lg uppercase font-bold text-text-primary">{t.author}</strong>
                  <span className="text-text-muted text-sm font-medium">{t.role}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6 bg-accent-soft" id="pricing">
        <div className="container mx-auto flex justify-center">
          <div className="bg-bg-surface border border-border rounded-xl shadow-md p-10 md:p-12 max-w-2xl w-full text-center">
            <h2 className="text-3xl font-bold uppercase text-text-primary mb-2">Free Forever</h2>
            <p className="text-lg font-medium text-text-secondary mb-8">Because job hunting is hard enough.</p>
            
            <ul className="flex flex-col gap-4 text-left mx-auto max-w-md mb-10">
              {['Unlimited ATS Checks', 'Unlimited AI Mock Interviews', '1-Click Portfolios', 'Project Finder', 'Cloud Resume Storage'].map(f => (
                <li key={f} className="flex items-center gap-4 text-lg font-medium text-text-primary">
                  <div className="bg-success-bg text-success rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  </div> 
                  {f}
                </li>
              ))}
            </ul>
            
            <Link to="/signup" className="btn btn-primary w-full py-4 text-lg justify-center">
              GET STARTED
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 text-center bg-bg-primary border-t border-border">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold uppercase mb-6 text-text-primary">
            Ready to land your dream job?
          </h2>
          <p className="text-xl font-medium text-text-secondary mb-10">
            Join thousands of other job seekers using Smart Apply to build their careers.
          </p>
          <Link to="/signup" className="btn btn-primary px-10 py-4 text-xl shadow-lg hover:shadow-xl transition-shadow">
            Start For Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>
          © {currentYear} <span className="text-accent">Smart Apply</span>. Built for students, by developers who care.
        </p>
      </footer>
    </div>
  );
}
