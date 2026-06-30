import React from 'react';
import { Mail, Linkedin, MapPin, Search, CheckCircle, Award, Target, Zap } from 'lucide-react';

export default function About() {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-12 pb-12">
      {/* Header Section */}
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-4">About Civic Saathi</h1>
        <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Civic Saathi is a next-generation community civic issue reporting platform that empowers citizens to report, track, and resolve local problems faster and smarter than ever before.
        </p>
      </div>

      {/* Developer Section */}
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col items-center gap-6 text-center">
        <img 
          src="/profile.jpg" 
          alt="Saket Sagar" 
          className="w-72 h-72 rounded-full border-4 border-blue-50 shadow-lg object-cover object-top"
        />
        <div className="flex-1">
          <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Owner & Developer</h2>
          <h3 className="text-2xl font-bold text-slate-800 tracking-tight mb-3">Saket Sagar</h3>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a href="mailto:saketsagar004@gmail.com" className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 font-medium transition-colors">
              <Mail className="w-4 h-4" />
              saketsagar004@gmail.com
            </a>
            <a href="https://www.linkedin.com/in/saketsagar" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 font-medium transition-colors">
              <Linkedin className="w-4 h-4" />
              linkedin.com/in/saketsagar
            </a>
          </div>
        </div>
      </div>

      {/* Key Features */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-6 flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-500" />
          Key Features
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <FeatureCard 
            icon={<Target className="w-6 h-6 text-blue-500" />}
            title="AI-Powered Issue Analysis"
            description="Upload a photo of any civic issue and Gemini Vision instantly identifies the issue type, assigns a severity level, generates a description, and routes it automatically."
          />
          <FeatureCard 
            icon={<MapPin className="w-6 h-6 text-red-500" />}
            title="Live Issue Map"
            description="All reported issues appear as color-coded markers on Google Maps in real time. Click any marker to view full issue details."
          />
          <FeatureCard 
            icon={<Search className="w-6 h-6 text-purple-500" />}
            title="Intelligent Duplicate Detection"
            description="Before submitting, the app automatically checks for existing reports within 100 meters of the same category, preventing duplicate entries."
          />
          <FeatureCard 
            icon={<CheckCircle className="w-6 h-6 text-emerald-500" />}
            title="Community Verification"
            description="Citizens can upvote and verify each other's reports, creating a trust layer that helps authorities prioritize genuine issues."
          />
          <FeatureCard 
            icon={<Award className="w-6 h-6 text-amber-500" />}
            title="Gamification & Badges"
            description="Users earn badges for civic participation like First Reporter, Community Hero, and Verified Citizen. This drives long-term engagement."
          />
          <FeatureCard 
            icon={<MapPin className="w-6 h-6 text-indigo-500" />}
            title="Smart Location Detection"
            description="Auto-detects GPS location, with a manual address fallback powered by Google Maps Geocoding API for seamless use across all devices."
          />
        </div>
      </div>

      {/* Differentiators */}
      <div className="bg-slate-800 rounded-2xl p-8 shadow-xl text-white">
        <h2 className="text-xl font-bold tracking-tight mb-6 text-slate-100">Why Civic Saathi?</h2>
        <ul className="space-y-4">
          <DifferentiatorItem text="No manual categorization: Gemini AI does it instantly from a photo" />
          <DifferentiatorItem text="Duplicate detection prevents report flooding" />
          <DifferentiatorItem text="Community-driven verification adds credibility" />
          <DifferentiatorItem text="Gamification sustains citizen engagement beyond one-time use" />
          <DifferentiatorItem text="Built entirely on Google technologies: Gemini, Firebase, Google Maps, Cloud Run" />
        </ul>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-4 border border-slate-100">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

function DifferentiatorItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
      <span className="text-sm text-slate-300 leading-relaxed font-medium">{text}</span>
    </li>
  );
}
