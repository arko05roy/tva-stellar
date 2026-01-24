"use client";

import React from "react";

interface ActivityBarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export default function ActivityBar({ activeTab, setActiveTab }: ActivityBarProps) {
    const items = [
        { id: "explorer", icon: "📁", label: "Explorer" },
        { id: "search", icon: "🔧", label: "Tools" },
        { id: "git", icon: "⚙️", label: "Build" },
        { id: "debug", icon: "🚀", label: "Deploy" },
    ];

    return (
        <div className="w-[48px] h-full flex flex-col bg-[#1e1e2e] border-r border-[#2b2b3b] justify-between">
            <div className="flex flex-col">
                {items.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        title={item.label}
                        className={`w-full h-[48px] flex items-center justify-center relative group transition-all
                            ${activeTab === item.id
                                ? "text-white bg-white/5"
                                : "text-[#4A4A4A] hover:text-[#B0B0B0]"
                            }`}
                    >
                        {activeTab === item.id && (
                            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#9B7FFF]" />
                        )}
                        <span className="text-lg">{item.icon}</span>
                    </button>
                ))}
            </div>

            <div className="flex flex-col pb-2">
                <button
                    title="GitHub"
                    className="w-full h-[48px] flex items-center justify-center text-[#4A4A4A] hover:text-[#B0B0B0] transition-colors"
                >
                    <span className="text-lg">🐙</span>
                </button>
                <button
                    title="Settings"
                    className="w-full h-[48px] flex items-center justify-center text-[#4A4A4A] hover:text-[#B0B0B0] transition-colors"
                >
                    <span className="text-lg">⚙️</span>
                </button>
            </div>
        </div>
    );
}
