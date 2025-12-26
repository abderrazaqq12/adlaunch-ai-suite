export default function Privacy() {
    return (
        <div className="py-24 px-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-bold mb-6">Privacy Policy</h1>
                <p className="text-gray-400 mb-12">Last updated: December 2024</p>

                <div className="prose prose-invert prose-gray max-w-none space-y-8">
                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">1. Introduction</h2>
                        <p className="text-gray-400 leading-relaxed">
                            AdLaunch AI ("we," "our," or "us") respects your privacy and is committed to protecting
                            your personal data. This Privacy Policy explains how we collect, use, store, and protect
                            your information when you use our platform.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">2. Information We Collect</h2>
                        <div className="space-y-4 text-gray-400">
                            <div className="p-4 bg-white/5 rounded-lg">
                                <h3 className="font-semibold text-white mb-2">Account Information</h3>
                                <p>Email address and name provided during account registration.</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                                <h3 className="font-semibold text-white mb-2">OAuth Tokens</h3>
                                <p>Access and refresh tokens from connected ad platforms (Google Ads, TikTok Ads, Snapchat Ads).
                                    These tokens are encrypted using AES-256-GCM encryption and stored securely.</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                                <h3 className="font-semibold text-white mb-2">Campaign Metadata</h3>
                                <p>Campaign names, status, and performance metrics from your connected ad accounts,
                                    as authorized by you during the OAuth connection process.</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">3. Information We Do NOT Collect</h2>
                        <ul className="list-disc list-inside text-gray-400 space-y-2">
                            <li>Passwords to your advertising accounts</li>
                            <li>Payment information or billing details from ad platforms</li>
                            <li>Personal information of your customers or end-users</li>
                            <li>Ad creative content (images, videos) unless explicitly uploaded by you</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">4. How We Use Your Data</h2>
                        <p className="text-gray-400 leading-relaxed mb-4">We use your data solely for the following purposes:</p>
                        <ul className="list-disc list-inside text-gray-400 space-y-2">
                            <li>Connecting and maintaining your ad account connections</li>
                            <li>Displaying campaign information in your dashboard</li>
                            <li>Executing actions you explicitly request (e.g., campaign management)</li>
                            <li>Providing AI-assisted recommendations based on your campaign data</li>
                            <li>Improving our services and user experience</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">5. Data Storage and Security</h2>
                        <div className="space-y-4 text-gray-400">
                            <p>We implement robust security measures to protect your data:</p>
                            <ul className="list-disc list-inside space-y-2">
                                <li><strong className="text-white">Encryption:</strong> All OAuth tokens are encrypted at rest using AES-256-GCM encryption</li>
                                <li><strong className="text-white">Access Control:</strong> Row-level security (RLS) ensures users can only access their own data</li>
                                <li><strong className="text-white">Secure Infrastructure:</strong> Data is hosted on secure, access-controlled servers</li>
                                <li><strong className="text-white">No Credential Storage:</strong> We never store your ad platform passwords</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">6. Data Sharing</h2>
                        <p className="text-gray-400 leading-relaxed">
                            We do not sell, trade, or otherwise transfer your personal information to third parties.
                            Your data is used solely to provide services to you and is never shared with advertisers,
                            data brokers, or other external parties.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">7. Your Rights</h2>
                        <p className="text-gray-400 leading-relaxed mb-4">You have the right to:</p>
                        <ul className="list-disc list-inside text-gray-400 space-y-2">
                            <li><strong className="text-white">Disconnect:</strong> Revoke access to any connected ad account at any time</li>
                            <li><strong className="text-white">Delete:</strong> Request deletion of your account and all associated data</li>
                            <li><strong className="text-white">Access:</strong> Request a copy of your personal data we hold</li>
                            <li><strong className="text-white">Correct:</strong> Update or correct inaccurate personal information</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">8. Cookies and Tracking</h2>
                        <p className="text-gray-400 leading-relaxed">
                            We use essential cookies to maintain your session and provide core functionality.
                            We do not use tracking cookies for advertising purposes.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">9. Changes to This Policy</h2>
                        <p className="text-gray-400 leading-relaxed">
                            We may update this Privacy Policy from time to time. We will notify you of any
                            significant changes by posting the new policy on this page and updating the
                            "Last updated" date.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">10. Contact Us</h2>
                        <p className="text-gray-400 leading-relaxed">
                            If you have any questions about this Privacy Policy or our data practices,
                            please contact us at:
                        </p>
                        <p className="text-violet-400 font-semibold mt-2">support@adlunch.cloud</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
