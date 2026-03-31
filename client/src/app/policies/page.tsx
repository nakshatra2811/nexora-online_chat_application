"use client";

import React from "react";
import { Shield, FileText, Scale, ArrowLeft, ExternalLink, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FloatingOrbs } from "@/components/FloatingOrbs";
import { APP_LOGO } from "@/lib/config";

export default function PoliciesPage() {
  const router = useRouter();

  const sections = [
    {
      title: "📜 NEXORA PRIVACY POLICY",
      icon: Shield,
      content: `Last Updated: March 2026

Welcome to Nexora. We are committed to protecting your privacy and ensuring you have a secure, private, and seamless communication experience. This Privacy Policy explains how we collect, use, and safeguard your information when you use our application.

1. Information We Collect
We believe in data minimization. We only collect what is strictly necessary to provide our services:
• Account Information: When you register, we collect your email address, username, and profile picture (if provided).
• Authentication Data: We use secure authentication providers (like Google or Firebase Auth) to verify your identity.
• Connection Data: We store your friend list and connection requests to enable communication.
• Technical Data: We may collect minimal device information (such as OS version and app version) to ensure compatibility and troubleshoot bugs.

2. What We Do NOT Collect
• Your Messages: Nexora uses end-to-end encryption principles. We do not read, scan, or store the plaintext content of your private messages, voice notes, or video calls.
• Your Vault Content: Files and notes stored in your personal Vault are encrypted and private to you.
• Location Data: We do not track your background location. Location sharing is strictly opt-in and live only when you actively share it with a specific friend.

3. How We Use Your Information
We use the collected data solely to:
• Create and manage your Nexora account.
• Facilitate real-time communication and notifications.
• Improve app performance, security, and stability.
• Prevent fraud, spam, and abuse on the platform.

4. Information Sharing & Disclosure
We will NEVER sell your personal data to advertisers or third parties. We may only disclose information if:
• Required by law, court order, or valid legal process.
• Necessary to protect the safety, rights, or property of Nexora, our users, or the public.

5. Data Retention & Deletion
Your data is retained only as long as your account is active. You have the right to delete your account at any time through the app settings. Upon deletion, your profile, connections, and associated data will be permanently removed from our active servers.

6. Children’s Privacy
Nexora is not intended for individuals under the age of 13. We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal data, we will take steps to delete it.

7. Changes to This Policy
We may update this Privacy Policy periodically. We will notify you of any significant changes via in-app announcements or email.`,
    },
    {
      title: "📜 TERMS & CONDITIONS",
      icon: FileText,
      content: `Last Updated: March 2026

By downloading, accessing, or using Nexora, you agree to be bound by these Terms & Conditions. If you do not agree, please do not use our services.

1. Eligibility & Account Security
• You must be at least 13 years old to use Nexora.
• You are responsible for maintaining the confidentiality of your account credentials.
• You agree to notify us immediately of any unauthorized use of your account.

2. Acceptable Use Policy
Nexora is built for safe, respectful communication. You agree NOT to use the platform to:
• Harass, bully, threaten, or impersonate others.
• Share illegal, explicit, or non-consensual content.
• Distribute malware, viruses, or engage in phishing activities.
• Attempt to reverse-engineer, hack, or disrupt the Nexora infrastructure.
• Use automated scripts or bots to scrape data or spam users.

3. User-Generated Content
You retain ownership of the content you send through Nexora. However, by using the app, you grant us the necessary technical licenses to transmit, route, and deliver your messages to your intended recipients. You are solely responsible for the content you share.

4. Account Suspension & Termination
We reserve the right to suspend or permanently ban accounts that violate these Terms, engage in illegal activities, or pose a risk to the Nexora community, without prior notice.

5. Intellectual Property
All Nexora branding, logos, software, and UI/UX designs are the intellectual property of Nexora. You may not copy, modify, or distribute our intellectual property without explicit written permission.

6. Modifications to the Service
We are constantly improving Nexora. We reserve the right to modify, suspend, or discontinue any feature of the app at any time, with or without notice.

7. Governing Law
These Terms shall be governed by and construed in accordance with applicable international laws, without regard to conflict of law principles.`,
    },
    {
      title: "⚖️ LEGAL DISCLAIMER",
      icon: Scale,
      content: `Last Updated: March 2026

1. "As Is" Basis
Nexora is provided on an "AS IS" and "AS AVAILABLE" basis. While we strive for perfection, we make no warranties, expressed or implied, regarding the app's reliability, accuracy, or uninterrupted availability.

2. Limitation of Liability
To the maximum extent permitted by law, Nexora and its developers shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from:
• Your access to or use of (or inability to access or use) the platform.
• Any conduct or content of any third party on the platform.
• Unauthorized access, use, or alteration of your transmissions or content.

3. Security Acknowledgment
While we implement industry-standard security measures and encryption, no method of transmission over the internet or electronic storage is 100% secure. You acknowledge that you use Nexora at your own risk.

4. Third-Party Links & Services
Nexora may contain links to third-party websites or integrate with third-party services (e.g., YouTube for the Cinema feature). We do not endorse and are not responsible for the content, privacy policies, or practices of any third-party services.

5. User Responsibility
You acknowledge that Nexora does not actively monitor private communications. You are entirely responsible for your interactions with other users. If you encounter abusive behavior, please use the in-app reporting tools or block the user.`,
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[#f0f2f8] text-[#1a1a2e] relative overflow-x-hidden">
      <FloatingOrbs opacity={0.05} />
      
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 md:py-20 space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#6c5ce7]/10 pb-10">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => router.push("/")}
              className="p-3 rounded-2xl glass-panel text-[#6c5ce7] shadow-sm active:shadow-inner transition-all"
            >
              <ArrowLeft size={22} />
            </motion.button>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-[#1a1a2e]">Legal & Privacy</h1>
              <p className="text-[#64748b] font-medium text-sm mt-1">Our commitment to your security.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-[#6c5ce7]/10 flex items-center justify-center">
                  <ShieldCheck size={14} className="text-[#6c5ce7]" />
                </div>
              ))}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6c5ce7] bg-[#6c5ce7]/10 px-3 py-1 rounded-full">Fully Encrypted</span>
          </div>
        </header>

        {/* Content Sections */}
        <div className="space-y-10">
          {sections.map((section, index) => (
            <motion.section
              key={section.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel p-8 md:p-10 border border-white/60 shadow-xl rounded-[2.5rem] relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                <section.icon size={120} />
              </div>

              <div className="flex items-center gap-4 mb-8">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#6c5ce7] to-[#00d4ff] text-white shadow-lg">
                  <section.icon size={26} />
                </div>
                <h2 className="text-2xl font-black text-[#1a1a2e] tracking-tight">{section.title}</h2>
              </div>

              <div className="text-[#4b5563] text-sm md:text-base leading-[1.8] whitespace-pre-line font-medium">
                {section.content}
              </div>
            </motion.section>
          ))}
        </div>

        {/* Dynamic Footer for this page */}
        <footer className="pt-20 pb-10 border-t border-[#6c5ce7]/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <img src={APP_LOGO} alt="Nexora" className="w-6 h-6" />
                <span className="font-black text-xl tracking-tighter">Nexora</span>
              </div>
              <p className="text-sm text-[#64748b] leading-relaxed max-w-sm font-medium">
                Nexora respects your privacy above all else. We provide the tools, but your conversations remain strictly yours. Use the platform responsibly and help us keep the void secure.
              </p>
              <div className="flex items-center gap-4 pt-2">
                <motion.a whileHover={{ y: -2 }} href="#" className="p-2 rounded-lg bg-white shadow-sm border border-[#6c5ce7]/10 text-[#6c5ce7]">
                  <Mail size={18} />
                </motion.a>
                <span className="text-xs font-bold text-[#64748b]">legal@nexora.io</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#6c5ce7]">Resources</h4>
                <ul className="space-y-2 text-sm font-bold text-[#1a1a2e]">
                  <li className="hover:text-[#6c5ce7] cursor-pointer flex items-center gap-1.5">Whitepaper <ExternalLink size={12} /></li>
                  <li className="hover:text-[#6c5ce7] cursor-pointer">Security Audit</li>
                  <li className="hover:text-[#6c5ce7] cursor-pointer">Open Source</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#6c5ce7]">Support</h4>
                <ul className="space-y-2 text-sm font-bold text-[#1a1a2e]">
                  <li className="hover:text-[#6c5ce7] cursor-pointer">Help Center</li>
                  <li className="hover:text-[#6c5ce7] cursor-pointer">Contact Us</li>
                  <li className="hover:text-[#6c5ce7] cursor-pointer">Status</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="mt-20 pt-8 border-t border-[#6c5ce7]/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest">
              &copy; 2026 Nexora Systems. Secure &bull; Privacy by Design.
            </p>
            <div className="flex items-center gap-6">
               <span className="text-[11px] font-bold text-[#64748b] cursor-pointer hover:text-[#6c5ce7]">Privacy Policy</span>
               <span className="text-[11px] font-bold text-[#64748b] cursor-pointer hover:text-[#6c5ce7]">Terms of Service</span>
               <span className="text-[11px] font-bold text-[#64748b] cursor-pointer hover:text-[#6c5ce7]">Disclaimer</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Subtle bottom glow */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-gradient-to-t from-[#6c5ce7]/5 to-transparent pointer-events-none blur-3xl z-0" />
    </div>
  );
}
