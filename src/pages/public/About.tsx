import { Shield, Lock, Eye, Users } from "lucide-react";

export default function About() {
    return (
        <div className="py-24 px-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold mb-6">About AdLaunch AI</h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        A software platform built to help advertisers manage their ad accounts efficiently and securely.
                    </p>
                </div>

                {/* Mission */}
                <div className="mb-16">
                    <h2 className="text-2xl font-bold mb-6">Our Mission</h2>
                    <p className="text-gray-400 text-lg leading-relaxed mb-6">
                        AdLaunch AI provides advertisers with a centralized platform to connect and manage their
                        advertising accounts across multiple platforms. We focus on security, transparency, and
                        user control, enabling businesses to streamline their advertising operations.
                    </p>
                    <p className="text-gray-400 text-lg leading-relaxed">
                        Our platform uses industry-standard OAuth 2.0 for secure account connections and
                        employs encryption to protect all sensitive data. We believe that advertisers should
                        have full visibility and control over their data at all times.
                    </p>
                </div>

                {/* Values */}
                <div className="mb-16">
                    <h2 className="text-2xl font-bold mb-8">Our Principles</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        {[
                            {
                                icon: Shield,
                                title: "Security First",
                                description: "All data is encrypted using AES-256-GCM. OAuth tokens are securely stored and never exposed."
                            },
                            {
                                icon: Eye,
                                title: "Transparency",
                                description: "Clear documentation of what data we access and how it's used. No hidden practices."
                            },
                            {
                                icon: Lock,
                                title: "User Control",
                                description: "You can disconnect your accounts and revoke access at any time. Your data, your control."
                            },
                            {
                                icon: Users,
                                title: "Data Isolation",
                                description: "Each user's data is isolated. We employ row-level security to ensure complete separation."
                            }
                        ].map((item, i) => (
                            <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                                <div className="w-12 h-12 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                                    <item.icon className="w-6 h-6 text-violet-400" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                                <p className="text-gray-400">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Platform Compliance */}
                <div className="p-8 bg-gradient-to-br from-violet-600/10 to-purple-600/10 border border-violet-500/20 rounded-2xl">
                    <h2 className="text-2xl font-bold mb-4">Platform Compliance</h2>
                    <p className="text-gray-400 leading-relaxed">
                        AdLaunch AI is designed to comply with the API policies and terms of service of all
                        supported advertising platforms, including Google Ads, TikTok Ads, and Snapchat Ads.
                        We only access data that users explicitly authorize and use it solely for the purposes
                        described in our Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
}
