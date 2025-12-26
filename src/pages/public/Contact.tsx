import { Mail, MessageSquare } from "lucide-react";

export default function Contact() {
    return (
        <div className="py-24 px-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold mb-6">Contact Us</h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Have questions about AdLaunch AI? We're here to help.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Contact Info */}
                    <div className="space-y-6">
                        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                            <div className="w-12 h-12 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                                <Mail className="w-6 h-6 text-violet-400" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Email Support</h3>
                            <p className="text-gray-400 mb-4">
                                For general inquiries, support requests, or partnership opportunities.
                            </p>
                            <a
                                href="mailto:support@adlunch.cloud"
                                className="text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                            >
                                support@adlunch.cloud
                            </a>
                        </div>

                        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                            <div className="w-12 h-12 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                                <MessageSquare className="w-6 h-6 text-violet-400" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Response Time</h3>
                            <p className="text-gray-400">
                                We typically respond to inquiries within 24-48 business hours.
                            </p>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="p-8 bg-white/5 border border-white/10 rounded-2xl">
                        <h2 className="text-xl font-semibold mb-6">Send a Message</h2>
                        <form className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-2">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                                    placeholder="Your name"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                                    placeholder="your@email.com"
                                />
                            </div>

                            <div>
                                <label htmlFor="subject" className="block text-sm font-medium text-gray-400 mb-2">
                                    Subject
                                </label>
                                <input
                                    type="text"
                                    id="subject"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                                    placeholder="How can we help?"
                                />
                            </div>

                            <div>
                                <label htmlFor="message" className="block text-sm font-medium text-gray-400 mb-2">
                                    Message
                                </label>
                                <textarea
                                    id="message"
                                    rows={4}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors resize-none"
                                    placeholder="Your message..."
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg hover:opacity-90 transition-opacity font-semibold"
                            >
                                Send Message
                            </button>
                        </form>
                        <p className="text-sm text-gray-500 mt-4">
                            By submitting this form, you agree to our Privacy Policy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
