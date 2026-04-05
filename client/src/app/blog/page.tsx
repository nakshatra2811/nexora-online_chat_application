"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, User, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { API_BASE_URL } from "@/lib/config";

export default function BlogPage() {
  const { isDark } = useTheme();
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/blogs`)
      .then(r => r.json())
      .then(d => {
        if (d?.blogs) {
           setBlogs(d.blogs.filter((b: any) => b.status === "Published"));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className={`h-[100dvh] overflow-y-auto custom-scrollbar font-sans selection:bg-[#6c5ce7] selection:text-white transition-colors duration-500 ease-in-out ${isDark ? 'bg-[#0f0f13] text-white' : 'bg-gray-50 text-gray-900'}`}>
      
      {/* Dynamic Background Noise & Blur */}
      <div className="fixed inset-0 pointer-events-none z-0 mix-blend-overlay opacity-20" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
      {isDark && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#6c5ce7] blur-[150px] opacity-20" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#00d4ff] blur-[150px] opacity-10" />
        </div>
      )}

      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-40 transition-all duration-300 backdrop-blur-3xl border-b`} style={{ background: isDark ? "rgba(10,10,15,0.7)" : "rgba(255,255,255,0.8)", borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6c5ce7] to-[#00d4ff] flex items-center justify-center shadow-lg">
              <ArrowLeft className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight hidden sm:block ml-2" style={{ color: "var(--text-primary)" }}>Nexora Studio</span>
          </Link>

          <div className="flex items-center gap-6 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            <span className="px-5 py-2.5 rounded-full bg-[#6c5ce7]/10 text-[#6c5ce7] font-bold">Research & Updates</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-40 md:pt-48 pb-16 px-6 max-w-7xl mx-auto">
         <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="max-w-3xl">
           <h1 className="text-5xl md:text-7xl font-black tracking-tighter" style={{ color: "var(--text-primary)" }}>Our latest<br/><span className="bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff] text-transparent bg-clip-text">thoughts & insights.</span></h1>
           <p className="text-xl mt-6 opacity-60 font-medium leading-relaxed">System updates, deep cryptographic research, and the future evolution of our Zero-Knowledge real-time messaging architecture.</p>
         </motion.div>
      </section>

      {/* Blog Grid */}
      <section className="relative z-10 px-6 pb-40 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
         {loading ? (
             <div className="col-span-full py-20 text-center opacity-50 font-medium">Synchronizing with Nexora Core...</div>
         ) : blogs.length === 0 ? (
             <div className="col-span-full py-20 text-center opacity-50 font-medium">No published articles available. Please check back later.</div>
         ) : blogs.map((post, i) => (
           <motion.div 
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -8 }}
              className="flex flex-col group cursor-pointer rounded-[2rem] overflow-hidden border transition-all duration-300"
              style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}
              onClick={() => setSelectedPost(post)}
           >
             {/* Thumbnail */}
             <div className="h-56 w-full overflow-hidden relative">
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10" />
                <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" />
                <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-xl border border-white/20" style={{ background: "rgba(0,0,0,0.5)" }}>
                   {post.category}
                </div>
             </div>
             
             {/* Content */}
             <div className="p-8 flex flex-col flex-1">
                <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {post.date}</span>
                  <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {post.author}</span>
                </div>
                
                <h2 className="text-2xl font-black tracking-tight mb-4 group-hover:text-[#6c5ce7] transition-colors line-clamp-2" style={{ color: "var(--text-primary)" }}>
                  {post.title}
                </h2>
                
                <p className="text-sm leading-relaxed opacity-60 mb-8 line-clamp-3 whitespace-pre-line">
                  {post.excerpt}
                </p>
                
                <div className="mt-auto pt-4 border-t flex items-center justify-between" style={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}>
                   <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#a29bfe" }}>Read Article</span>
                   <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all bg-[#6c5ce7]/10 group-hover:bg-[#6c5ce7] group-hover:text-white">
                      <ChevronRight className="w-4 h-4" />
                   </div>
                </div>
             </div>
           </motion.div>
         ))}
      </section>

      {/* Article Full View Modal */}
      <AnimatePresence>
        {selectedPost && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 overflow-y-auto custom-scrollbar flex flex-col backdrop-blur-xl bg-black/60`} 
          >
            <div className={`min-h-screen w-full`}>
               {/* Modal Header */}
               <div className="sticky top-0 z-50 w-full flex items-center justify-end px-6 py-4">
                  <button onClick={() => setSelectedPost(null)} className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 text-white hover:bg-[#ff006e] transition-colors backdrop-blur-xl shadow-lg border border-white/10">
                     <X className="w-6 h-6" />
                  </button>
               </div>
               
               {/* Modal Content */}
               <motion.div 
                 initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                 className={`max-w-4xl mx-auto w-full mb-20 rounded-[3rem] overflow-hidden shadow-2xl border ${isDark ? 'bg-[#101018]' : 'bg-white'}`}
                 style={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}
               >
                  <div className="h-64 sm:h-96 w-full relative">
                     <img src={selectedPost.image} alt={selectedPost.title} className="w-full h-full object-cover" />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                     <div className="absolute bottom-8 left-8 right-8">
                        <div className="mb-4 inline-block px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest text-white border border-white/20" style={{ background: "rgba(108,92,231,0.5)", backdropFilter: "blur(10px)" }}>
                           {selectedPost.category}
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">{selectedPost.title}</h1>
                     </div>
                  </div>
                  
                  <div className="p-8 sm:p-16">
                     <div className="flex items-center gap-6 pb-8 border-b mb-8 text-sm font-bold uppercase tracking-widest" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)", color: "var(--text-muted)" }}>
                        <span className="flex items-center gap-2 text-[#6c5ce7]"><User className="w-5 h-5" /> {selectedPost.author}</span>
                        <span className="flex items-center gap-2"><Clock className="w-5 h-5" /> {selectedPost.date}</span>
                     </div>
                     
                     <div className="prose prose-lg max-w-none text-base sm:text-lg leading-loose whitespace-pre-wrap" style={{ color: "var(--text-primary)", fontFamily: "inherit" }}>
                        {selectedPost.excerpt}
                     </div>
                  </div>
               </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
