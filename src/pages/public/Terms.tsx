export default function Terms() {
    return (
        <div className="py-24 px-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-bold mb-6">Terms of Service</h1>
                <p className="text-gray-400 mb-12">Last updated: December 2024</p>

                <div className="prose prose-invert prose-gray max-w-none space-y-8">
                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">1. Acceptance of Terms</h2>
                        <p className="text-gray-400 leading-relaxed">
                            By accessing or using AdLaunch AI ("the Service"), you agree to be bound by these
                            Terms of Service. If you do not agree to these terms, please do not use the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">2. Description of Service</h2>
                        <p className="text-gray-400 leading-relaxed">
                            AdLaunch AI is a software platform that allows users to connect their advertising
                            accounts (Google Ads, TikTok Ads, Snapchat Ads) via OAuth and manage their campaigns
                            through a unified dashboard. The Service provides tools for campaign management,
                            monitoring, and AI-assisted recommendations.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">3. User Responsibilities</h2>
                        <p className="text-gray-400 leading-relaxed mb-4">As a user of the Service, you agree to:</p>
                        <ul className="list-disc list-inside text-gray-400 space-y-2">
                            <li>Provide accurate and complete information during registration</li>
                            <li>Maintain the security of your account credentials</li>
                            <li>Comply with the terms and policies of connected advertising platforms</li>
                            <li>Use the Service only for lawful purposes</li>
                            <li>Not attempt to access other users' data or accounts</li>
                            <li>Not use the Service to engage in fraudulent or deceptive advertising practices</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">4. OAuth Connections</h2>
                        <p className="text-gray-400 leading-relaxed">
                            When you connect your advertising accounts through OAuth, you authorize AdLaunch AI
                            to access certain data and perform actions on your behalf as described during the
                            authorization process. You can revoke this access at any time through your account
                            settings or directly through the respective advertising platform.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">5. No Performance Guarantees</h2>
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <p className="text-gray-300 leading-relaxed">
                                <strong className="text-yellow-400">Important:</strong> AdLaunch AI is a management and
                                automation tool. We do not guarantee any specific advertising results, returns on
                                investment, or campaign performance. Advertising results depend on many factors
                                outside our control, including market conditions, ad creative quality, targeting
                                settings, and platform algorithms.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">6. Service Availability</h2>
                        <p className="text-gray-400 leading-relaxed">
                            We strive to maintain high availability of the Service but do not guarantee
                            uninterrupted access. The Service may be temporarily unavailable due to maintenance,
                            updates, or circumstances beyond our control. We will make reasonable efforts to
                            minimize disruptions and provide advance notice when possible.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">7. Intellectual Property</h2>
                        <p className="text-gray-400 leading-relaxed">
                            The Service, including its design, features, and content, is protected by intellectual
                            property laws. You may not copy, modify, distribute, or reverse engineer any part of
                            the Service without our prior written consent.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">8. Limitation of Liability</h2>
                        <p className="text-gray-400 leading-relaxed">
                            To the maximum extent permitted by law, AdLaunch AI shall not be liable for any
                            indirect, incidental, special, consequential, or punitive damages, including but
                            not limited to loss of profits, data, or business opportunities, arising from your
                            use of the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">9. Indemnification</h2>
                        <p className="text-gray-400 leading-relaxed">
                            You agree to indemnify and hold harmless AdLaunch AI, its affiliates, and their
                            respective officers, directors, employees, and agents from any claims, damages,
                            losses, or expenses arising from your use of the Service or violation of these Terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">10. Account Termination</h2>
                        <p className="text-gray-400 leading-relaxed">
                            We reserve the right to suspend or terminate your account if you violate these
                            Terms or engage in activities that harm the Service or other users. You may also
                            terminate your account at any time by contacting us.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">11. Changes to Terms</h2>
                        <p className="text-gray-400 leading-relaxed">
                            We may modify these Terms at any time. Continued use of the Service after changes
                            are posted constitutes acceptance of the modified Terms. We will notify you of
                            significant changes via email or through the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">12. Governing Law</h2>
                        <p className="text-gray-400 leading-relaxed">
                            These Terms shall be governed by and construed in accordance with applicable law,
                            without regard to conflict of law principles. Any disputes arising from these Terms
                            or the Service shall be resolved through good faith negotiation.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-white">13. Contact</h2>
                        <p className="text-gray-400 leading-relaxed">
                            For questions about these Terms of Service, please contact us at:
                        </p>
                        <p className="text-violet-400 font-semibold mt-2">support@adlunch.cloud</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
