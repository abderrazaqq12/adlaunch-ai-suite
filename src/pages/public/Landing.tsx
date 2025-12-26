import { Link } from "react-router-dom";
import { Shield, BarChart3, Bot, Lock, ArrowRight, CheckCircle } from "lucide-react";

export default function Landing() {
    return (
        <div className="relative">
            {/* Hero Section */}
            <section className="relative py-24 px-6 overflow-hidden">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-violet-600/10 via-transparent to-transparent" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/20 blur-[120px] rounded-full" />

                <div className="relative max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-8">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm text-gray-300">Now supporting Google Ads, TikTok Ads & Snapchat Ads</span>
                    </div>

                    <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                        Connect, manage, and automate your ad accounts —{" "}
                        <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                            securely.
                        </span>
                    </h1>

                    <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
                        One platform for all your advertising accounts. Secure OAuth connections,
                        centralized management, and AI-assisted campaign planning.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            to="/auth"
                            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl hover:opacity-90 transition-opacity font-semibold text-lg"
                        >
                            Get Started <ArrowRight className="w-5 h-5" />
                        </Link>
                        <Link
                            to="/about"
                            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors font-semibold text-lg"
                        >
                            Learn More
                        </Link>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">What AdLaunch AI Does</h2>
                        <p className="text-gray-400 text-lg">Everything you need to manage ad accounts securely</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            {
                                icon: Shield,
                                title: "Secure OAuth Connections",
                                description: "Connect your ad accounts via industry-standard OAuth 2.0. No passwords stored."
                            },
                            {
                                icon: BarChart3,
                                title: "Centralized Management",
                                description: "View and manage all your ad accounts from one unified dashboard."
                            },
                            {
                                icon: Bot,
                                title: "AI-Assisted Planning",
                                description: "Get smart campaign recommendations powered by AI analysis."
                            },
                            {
                                icon: Lock,
                                title: "User Data Isolation",
                                description: "Your data is isolated and never shared. Full row-level security."
                            }
                        ].map((feature, i) => (
                            <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-violet-500/50 transition-colors">
                                <div className="w-12 h-12 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                                    <feature.icon className="w-6 h-6 text-violet-400" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                                <p className="text-gray-400 text-sm">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-24 px-6 bg-gradient-to-b from-transparent via-violet-600/5 to-transparent">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
                        <p className="text-gray-400 text-lg">Get started in three simple steps</p>
                    </div>

                    <div className="space-y-8">
                        {[
                            {
                                step: "01",
                                title: "Connect Your Ad Account",
                                description: "Use secure OAuth to connect your Google Ads, TikTok Ads, or Snapchat Ads account. No credentials are stored."
                            },
                            {
                                step: "02",
                                title: "Review Permissions",
                                description: "See exactly what data is accessed and how it's used. Full transparency and control."
                            },
                            {
                                step: "03",
                                title: "Manage & Automate",
                                description: "Access your campaigns, get AI recommendations, and automate optimization."
                            }
                        ].map((step, i) => (
                            <div key={i} className="flex gap-6 items-start p-6 bg-white/5 border border-white/10 rounded-2xl">
                                <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center font-bold shrink-0">
                                    {step.step}
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                                    <p className="text-gray-400">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Supported Platforms */}
            <section className="py-24 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Supported Platforms</h2>
                    <p className="text-gray-400 text-lg mb-12">Connect your accounts from major advertising platforms</p>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { name: "Google Ads", color: "from-blue-500 to-blue-600" },
                            { name: "TikTok Ads", color: "from-pink-500 to-red-500" },
                            { name: "Snapchat Ads", color: "from-yellow-400 to-yellow-500" }
                        ].map((platform, i) => (
                            <div key={i} className="p-8 bg-white/5 border border-white/10 rounded-2xl">
                                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${platform.color} flex items-center justify-center`}>
                                    <CheckCircle className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-xl font-semibold">{platform.name}</h3>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Security Section */}
            <section className="py-24 px-6 bg-gradient-to-b from-transparent via-violet-600/5 to-transparent">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Security & Compliance</h2>
                    <p className="text-gray-400 text-lg mb-12">Built with security at the core</p>

                    <div className="grid md:grid-cols-4 gap-4">
                        {[
                            "OAuth 2.0 Standard",
                            "AES-256 Encryption",
                            "Row-Level Security",
                            "No Credential Storage"
                        ].map((item, i) => (
                            <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                                <span className="text-sm font-medium">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to get started?</h2>
                    <p className="text-gray-400 text-lg mb-8">Connect your ad accounts securely in minutes.</p>
                    <Link
                        to="/auth"
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl hover:opacity-90 transition-opacity font-semibold text-lg"
                    >
                        Connect Ad Account <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </section>
        </div>
    );
}
