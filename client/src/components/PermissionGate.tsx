"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Users, Shield, ArrowRight, X, Smartphone, Database, CheckCircle2 } from 'lucide-react';

interface PermissionGateProps {
    children: React.ReactNode;
}

const PermissionItem = ({ icon, title, desc, active, onClick }: { icon: any, title: string, desc: string, active: boolean, onClick: () => void }) => (
    <motion.div 
        onClick={onClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group backdrop-blur-md ${active ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'}`}
    >
        <div className={`flex items-center justify-center shrink-0 w-12 h-12 rounded-xl transition-all duration-300 ${active ? 'text-green-400 bg-green-500/20 scale-105' : 'text-[#6c5ce7] bg-[#6c5ce7]/10 group-hover:bg-[#6c5ce7]/20 group-hover:scale-105'}`}>
            {active ? <CheckCircle2 className="w-6 h-6" /> : icon}
        </div>
        <div className="flex-1 min-w-0">
            <h4 className={`text-sm font-bold truncate transition-colors ${active ? 'text-green-400' : 'text-zinc-100'}`}>{title}</h4>
            <p className="text-xs font-semibold text-zinc-400 leading-tight truncate mt-0.5">{desc}</p>
        </div>
        <div className="shrink-0 flex items-center justify-center w-6 h-6">
            <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${active ? 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.8)] scale-100' : 'bg-zinc-600 scale-50 group-hover:scale-75'}`} />
        </div>
    </motion.div>
);

export const PermissionGate: React.FC<PermissionGateProps> = ({ children }) => {
    const [showModal, setShowModal] = useState(false);
    const [permissions, setPermissions] = useState({
        camera: false,
        contacts: false,
        storage: false,
    });

    useEffect(() => {
        const stored = localStorage.getItem('nexora_permissions_granted');
        if (!stored) {
            setShowModal(true);
        }
    }, []);

    const requestCamera = async () => {
        // Visual acknowledgement only. Actual browser prompt happens EXACTLY when a call is started (on-demand).
        setPermissions(prev => ({ ...prev, camera: true }));
    };

    const requestContacts = async () => {
        // Visual acknowledgement only.
        setPermissions(prev => ({ ...prev, contacts: true }));
    };

    const requestStorage = async () => {
        // Visual acknowledgement only.
        setPermissions(prev => ({ ...prev, storage: true }));
    };

    const handleGrantAll = async () => {
        await requestCamera();
        await requestContacts();
        await requestStorage();
        
        localStorage.setItem('nexora_permissions_granted', 'true');
        setTimeout(() => setShowModal(false), 800);
    };

    if (!showModal) return <>{children}</>;

    return (
        <>
            {children}
            <AnimatePresence>
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-xl"
                    />
                    
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 40 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 40 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-[420px] rounded-[32px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
                        style={{ background: "rgba(18, 18, 26, 0.8)", backdropFilter: "blur(20px)", border: "1px solid rgba(255, 255, 255, 0.08)" }}
                    >
                        {/* Header area - no solid background, just an overarching glow */}
                        <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#6c5ce7] rounded-full mix-blend-screen filter blur-[100px] opacity-30 animate-pulse pointer-events-none" />
                        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-[#00d4ff] rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-pulse pointer-events-none" />

                        <div className="relative z-10 p-8 pt-10 flex flex-col items-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6c5ce7] to-[#00d4ff] flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20 relative">
                                <div className="absolute inset-0 bg-white/20 rounded-2xl animate-pulse" />
                                <Shield className="w-8 h-8 text-white relative z-10" />
                            </div>

                            <h2 className="text-2xl font-extrabold text-white mb-2 text-center tracking-tight">
                                Protocol Initialization
                            </h2>
                            <p className="text-zinc-400 text-[13px] font-medium text-center mb-8 px-2 leading-relaxed">
                                Review the core requirements. Nexora will <span className="text-[#00d4ff] font-bold">never</span> request these until the exact moment you use the feature.
                            </p>

                            <div className="w-full space-y-3 mb-8">
                                <PermissionItem 
                                    icon={<Camera className="w-5 h-5" />}
                                    title="Camera & Voice"
                                    desc="Requested only when you initiate a call."
                                    active={permissions.camera}
                                    onClick={requestCamera}
                                />
                                <PermissionItem 
                                    icon={<Users className="w-5 h-5" />}
                                    title="Identity Graph"
                                    desc="For securing zero-knowledge P2P relays."
                                    active={permissions.contacts}
                                    onClick={requestContacts}
                                />
                                <PermissionItem 
                                    icon={<Database className="w-5 h-5" />}
                                    title="Local Vault"
                                    desc="Requested when saving offline archives."
                                    active={permissions.storage}
                                    onClick={requestStorage}
                                />
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleGrantAll}
                                className="w-full py-4 rounded-2xl text-white font-bold text-[15px] shadow-[0_10px_30px_rgba(108,92,231,0.3)] flex items-center justify-center gap-3 relative overflow-hidden group"
                                style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                                <span className="relative z-10 flex items-center gap-2">
                                    {Object.values(permissions).every(p => p) ? "Acknowledge Secure Protocol" : "Acknowledge Requirements"} 
                                    {Object.values(permissions).every(p => p) ? <CheckCircle2 className="w-5 h-5 text-white animate-pulse" /> : <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> }
                                </span>
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>
        </>
    );
};
