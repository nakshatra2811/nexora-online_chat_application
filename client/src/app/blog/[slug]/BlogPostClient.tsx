"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Clock, User, Share2, Link2, Check } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { useState, useEffect } from "react";

// ── Custom SVG Brand Icons ──
function TwitterXIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function SnapchatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.25c-3.15 0-5.7 1.25-5.7 3.75 0 .6.15 1.05.3 1.35C5.1 7.2 3 8.55 3 11.25c0 1.2.6 2.1 2.25 2.7-.15.45-.6 2.25-1.05 2.85-.3.45-.45.6-.45.75 0 .15.15.3.3.3h15.9c.15 0 .3-.15.3-.3 0-.15-.15-.3-.45-.75-.45-.6-.9-2.4-1.05-2.85 1.65-.6 2.25-1.5 2.25-2.7 0-2.7-2.1-4.05-3.6-3.9.15-.3.3-.75.3-1.35 0-2.5-2.55-3.75-5.7-3.75zM12 21c-1.5 0-2.25-.75-3-1.5 0-.15.15-.15.3-.15h5.4c.15 0 .3 0 .3.15-.75.75-1.5 1.5-3 1.5z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
  );
}

export default function BlogPostClient({ post, slug }: { post: any; slug: string }) {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);
  
  // Use current origin if available, fallback to hardcoded production URL
  const [siteUrl, setSiteUrl] = useState("https://nexora-online-chat-application.vercel.app");
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      setSiteUrl(window.location.origin);
    }
  }, []);

  const postUrl = `${siteUrl}/blog/${slug}`;
  const shareText = post ? `${post.title} — Read on Nexora Blog` : "Check this out on Nexora Blog";

  const shareLinks = [
    {
      label: "Instagram",
      icon: <InstagramIcon className="w-4 h-4" />,
      color: "#E4405F",
      bg: "rgba(228,64,95,0.10)",
      darkColor: "#E4405F",
      darkBg: "rgba(228,64,95,0.12)",
      href: `https://www.instagram.com/direct/inbox/`,
    },
    {
      label: "Snapchat",
      icon: <SnapchatIcon className="w-4 h-4" />,
      color: "#FFFC00",
      bg: "rgba(255,252,0,0.10)",
      darkColor: "#FFFC00",
      darkBg: "rgba(255,252,0,0.12)",
      href: `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(postUrl)}`,
    },
    {
      label: "Twitter / X",
      icon: <TwitterXIcon className="w-4 h-4" />,
      color: "#000000",
      bg: "rgba(0,0,0,0.08)",
      darkColor: "#ffffff",
      darkBg: "rgba(255,255,255,0.1)",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(postUrl)}`,
    },
    {
      label: "WhatsApp",
      icon: <WhatsAppIcon className="w-4 h-4" />,
      color: "#25D366",
      bg: "rgba(37,211,102,0.10)",
      darkColor: "#25D366",
      darkBg: "rgba(37,211,102,0.12)",
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + postUrl)}`,
    },
    {
      label: "LinkedIn",
      icon: <LinkedInIcon className="w-4 h-4" />,
      color: "#0A66C2",
      bg: "rgba(10,102,194,0.10)",
      darkColor: "#0A66C2",
      darkBg: "rgba(10,102,194,0.12)",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`,
    },
    {
      label: "Facebook",
      icon: <FacebookIcon className="w-4 h-4" />,
      color: "#1877F2",
      bg: "rgba(24,119,242,0.10)",
      darkColor: "#1877F2",
      darkBg: "rgba(24,119,242,0.12)",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`,
    },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(postUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!post) {
    return (
      <div className={`min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center transition-colors duration-500 ease-in-out ${isDark ? 'bg-[#0f0f13] text-white' : 'bg-gray-50 text-gray-900'}`}>
        <motion.div
           initial={{ scale: 0.8, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           className="relative mb-8 sm:mb-12"
        >
          <div className="absolute inset-0 bg-[#6c5ce7] blur-[120px] opacity-20 animate-pulse" />
          <div className="relative text-[120px] sm:text-[180px] font-black leading-none tracking-tighter opacity-10 select-none">404</div>
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-[#6c5ce7] to-[#a29bfe] flex items-center justify-center shadow-[0_20px_50px_rgba(108,92,231,0.3)] border border-white/20">
               <ArrowLeft className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
             </div>
          </div>
        </motion.div>
        
        <h1 className="text-3xl sm:text-5xl font-black mb-4 sm:mb-6 tracking-tight">Article not found.</h1>
        <p className="text-base sm:text-lg opacity-60 mb-10 max-w-md font-medium leading-relaxed">
          The transmission might have been redacted or the encrypted link has expired. Secure communication is our priority.
        </p>
        
        <Link href="/blog" 
          className="group relative flex items-center gap-3 px-8 sm:px-10 py-4 sm:py-5 rounded-[2rem] font-black text-base sm:text-lg transition-all active:scale-95 shadow-[0_15px_40px_rgba(108,92,231,0.2)] hover:shadow-[0_20px_50px_rgba(108,92,231,0.3)] overflow-hidden"
          style={{ background: "#6c5ce7", color: "#fff" }}>
          <span className="relative z-10 flex items-center gap-2">
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            Return to Hub
          </span>
          <div className="absolute inset-0 rounded-[2rem] bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen overflow-y-auto custom-scrollbar font-sans transition-colors duration-500 ${isDark ? "bg-[#0f0f13] text-white" : "bg-gray-50 text-gray-900"}`}>
      {isDark && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#6c5ce7] blur-[150px] opacity-20" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#00d4ff] blur-[150px] opacity-10" />
        </div>
      )}

      {/* Nav */}
      <nav className="fixed top-0 w-full z-40 backdrop-blur-3xl border-b" style={{ background: isDark ? "rgba(10,10,15,0.7)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}>
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/blog" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6c5ce7] to-[#00d4ff] flex items-center justify-center shadow-lg">
              <ArrowLeft className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight hidden sm:block ml-1" style={{ color: "var(--text-primary)" }}>Back to Blog</span>
          </Link>

          {/* Quick share icons in nav */}
          <div className="flex items-center gap-2">
            {shareLinks.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                title={`Share on ${s.label}`}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style={{ background: isDark ? s.darkBg : s.bg, color: isDark ? s.darkColor : s.color }}>
                {s.icon}
              </a>
            ))}
            <button onClick={handleCopy} title="Copy link"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "rgba(108,92,231,0.12)", color: "#6c5ce7" }}>
              {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Image */}
      <div className="relative w-full h-64 sm:h-[420px] mt-20">
        <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute bottom-8 left-0 right-0 max-w-5xl mx-auto px-6">
          <div className="inline-block mb-4 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest text-white border border-white/20"
            style={{ background: "rgba(108,92,231,0.55)", backdropFilter: "blur(10px)" }}>
            {post.category}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">{post.title}</h1>
        </div>
      </div>

      {/* Article body */}
      <div className="max-w-5xl mx-auto px-6 py-12 relative z-10">
        <div className="flex items-center gap-6 pb-8 border-b mb-8 text-sm font-bold uppercase tracking-widest"
          style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)", color: "var(--text-muted)" }}>
          <span className="flex items-center gap-2 text-[#6c5ce7]"><User className="w-5 h-5" /> {post.author}</span>
          <span className="flex items-center gap-2"><Clock className="w-5 h-5" /> {post.date}</span>
        </div>

        <div className="prose prose-lg max-w-none text-base sm:text-lg leading-loose whitespace-pre-wrap mb-12" style={{ color: "var(--text-primary)", fontFamily: "inherit" }}>
          {post.excerpt}
        </div>

        {/* ── SHARE SECTION ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-[2rem] p-8 border"
          style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-3 mb-6">
            <Share2 className="w-5 h-5 text-[#6c5ce7]" />
            <h3 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>Share this article</h3>
          </div>

          <div className="flex flex-wrap gap-3">
            {shareLinks.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-105 active:scale-95 border"
                style={{
                  background: isDark ? s.darkBg : s.bg,
                  color: isDark ? s.darkColor : s.color,
                  borderColor: `${isDark ? s.darkColor : s.color}22`
                }}>
                {s.icon}
                {s.label}
              </a>
            ))}
            <button onClick={handleCopy}
              className="flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-105 active:scale-95 border"
              style={{
                background: copied ? "rgba(46,213,115,0.12)" : "rgba(108,92,231,0.12)",
                color: copied ? "#2ed573" : "#6c5ce7",
                borderColor: copied ? "#2ed57322" : "#6c5ce722"
              }}>
              {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {copied ? "Link Copied!" : "Copy Link"}
            </button>
          </div>

          <p className="text-xs mt-5 opacity-40 font-medium">
            🔗 When shared, this link shows the article title, description & thumbnail on WhatsApp, Twitter, LinkedIn & Facebook automatically.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
