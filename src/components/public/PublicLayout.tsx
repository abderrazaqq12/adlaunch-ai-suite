import { Link, Outlet } from "react-router-dom";

export function PublicLayout() {
    return (
        <div className="min-h-screen bg-[#0F0F14] text-white">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0F0F14]/90 backdrop-blur-md border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">A</span>
                        </div>
                        <span className="text-xl font-semibold">AdLaunch AI</span>
                    </Link>

                    <div className="hidden md:flex items-center gap-8">
                        <Link to="/about" className="text-gray-400 hover:text-white transition-colors">About</Link>
                        <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy</Link>
                        <Link to="/terms" className="text-gray-400 hover:text-white transition-colors">Terms</Link>
                        <Link to="/contact" className="text-gray-400 hover:text-white transition-colors">Contact</Link>
                    </div>

                    <Link
                        to="/auth"
                        className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg hover:opacity-90 transition-opacity font-medium"
                    >
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-20">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 bg-[#0A0A0F] py-12">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-4 gap-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">A</span>
                                </div>
                                <span className="text-lg font-semibold">AdLaunch AI</span>
                            </div>
                            <p className="text-gray-500 text-sm">
                                Secure ad account management for modern advertisers.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-4">Product</h4>
                            <ul className="space-y-2 text-gray-400">
                                <li><Link to="/" className="hover:text-white transition-colors">Features</Link></li>
                                <li><Link to="/auth" className="hover:text-white transition-colors">Get Started</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-4">Company</h4>
                            <ul className="space-y-2 text-gray-400">
                                <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
                                <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-4">Legal</h4>
                            <ul className="space-y-2 text-gray-400">
                                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                                <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                            </ul>
                        </div>
                    </div>

                    <div className="mt-12 pt-8 border-t border-white/5 text-center text-gray-500 text-sm">
                        © {new Date().getFullYear()} AdLaunch AI. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}
