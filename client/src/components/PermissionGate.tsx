"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Users, Shield, ArrowRight, X, Smartphone, Database, CheckCircle2 } from 'lucide-react';

interface PermissionGateProps {
    children: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({ children }) => {
    const [showModal, setShowModal] = useState(false);
    const [permissions, setPermissions] = useState({
        camera: false,
        contacts: false,
        storage: false,
    });

    useEffect(() => {
        // Check if permissions were already granted (mocked for demo)
        const stored = localStorage.getItem('nexora_permissions_granted');
        if (!stored) {
            setShowModal(true);
        }
    }, []);

    const requestCamera = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setPermissions(prev => ({ ...prev, camera: true }));
        } catch (err) {
            console.error("Camera access denied:", err);
        }
    };

    const requestContacts = async () => {
        // Browser standard Contact Picker API is restricted/experimental
        // We'll mock the "Grant" for UX and explain its used for finding friends
        setPermissions(prev => ({ ...prev, contacts: true }));
    };

    const requestStorage = async () => {
        // Mock storage permission request
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
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />
                    
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20"
                    >
                        {/* Header */}
                        <div className="relative h-32 bg-gradient-to-br from-[#6c5ce7] to-[#00d4ff] flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 opacity-20">
                                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_30%,white_0%,transparent_70%)]" />
                            </div>
                            <Shield className="w-16 h-16 text-white relative z-10" />
                        </div>

                        <div className="p-8 pt-10 text-center">
                            <h2 className="text-3xl font-black text-[#1a1a2e] mb-2 tracking-tight italic">
                                Initialize Protocol
                            </h2>
                            <p className="text-[#64748b] text-sm mb-10 px-4 leading-relaxed font-semibold">
                                To enable the full Nexora Private Protocol and secure communication, we need active clearance.
                            </p>

                            <div className="space-y-4 mb-10">
                                <PermissionItem 
                                    icon={<Camera className="w-5 h-5" />}
                                    title="Camera & Microphone"
                                    desc="For high-definition encrypted voice and video tunnels."
                                    active={permissions.camera}
                                    onClick={requestCamera}
                                />
                                <PermissionItem 
                                    icon={<Users className="w-5 h-5" />}
                                    title="Identity Synchronization"
                                    desc="Securely find your contacts who are already on the grid."
                                    active={permissions.contacts}
                                    onClick={requestContacts}
                                />
                                <PermissionItem 
                                    icon={<Database className="w-5 h-5" />}
                                    title="Local Persistent Vault"
                                    desc="Store encrypted message history and offline media."
                                    active={permissions.storage}
                                    onClick={requestStorage}
                                />
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleGrantAll}
                                className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#1a1a2e] to-[#2d3436] text-white font-bold text-lg shadow-xl shadow-indigo-500/10 flex items-center justify-center gap-3 group transition-all"
                            >
                                {Object.values(permissions).every(p => p) ? "Protocol Initialized" : "Grant Access"} 
                                {Object.values(permissions).every(p => p) ? <CheckCircle2 className="w-6 h-6 text-green-400 animate-pulse" /> : <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /> }
                            </motion.button>

                            <button 
                                onClick={() => setShowModal(false)}
                                className="mt-6 text-[10px] uppercase tracking-widest font-black text-[#94a3b8] hover:text-[#6c5ce7] transition-colors cursor-pointer"
                            >
                                Setup Later (Limited Experience)
                            </button>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>
        </>
    );
};

const PermissionItem = ({ icon, title, desc, active, onClick }: { icon: any, title: string, desc: string, active: boolean, onClick: () => void }) => (
    <motion.div 
        onClick={onClick}
        whileHover={{ x: 5 }}
        className="flex items-center gap-5 p-5 rounded-3xl bg-gray-50 border border-gray-100/50 text-left hover:bg-white hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden"
    >
        <div className={`p-4 rounded-2xl bg-white shadow-sm transition-colors ${active ? 'text-green-500 bg-green-50' : 'text-[#6c5ce7]'}`}>
            {active ? <CheckCircle2 className="w-5 h-5" /> : icon}
        </div>
        <div className="flex-1 min-w-0">
            <h4 className="text-[15px] font-bold text-[#1a1a2e] truncate">{title}</h4>
            <p className="text-[12px] font-medium text-[#94a3b8] leading-tight truncate">{desc}</p>
        </div>
        <div className={`w-2 h-2 rounded-full transition-colors ${active ? 'bg-green-500' : 'bg-gray-200'}`} />
    </motion.div>
);
