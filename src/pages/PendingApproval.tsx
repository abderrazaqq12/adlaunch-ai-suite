import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, Mail, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectStore } from "@/stores/projectStore";

export default function PendingApproval() {
    const navigate = useNavigate();
    const { setUser } = useProjectStore();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        navigate("/auth");
    };

    const handleCheckAgain = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("approved")
                .eq("id", user.id)
                .single();

            if (profile?.approved) {
                navigate("/dashboard");
            }
        }
    };

    return (
        <div className="min-h-screen bg-[#0F0F14] flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center">
                <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-violet-500/10 flex items-center justify-center">
                    <Clock className="w-10 h-10 text-violet-400" />
                </div>

                <h1 className="text-3xl font-bold text-white mb-4">
                    Account Pending Approval
                </h1>

                <p className="text-gray-400 mb-8">
                    Thank you for signing up! Your account is currently pending review by our team.
                    You will receive an email once your account has been approved.
                </p>

                <div className="p-4 bg-white/5 border border-white/10 rounded-xl mb-8">
                    <div className="flex items-center gap-3 text-gray-400">
                        <Mail className="w-5 h-5 text-violet-400" />
                        <span className="text-sm">
                            We'll notify you at your registered email when approved.
                        </span>
                    </div>
                </div>

                <div className="space-y-3">
                    <Button
                        onClick={handleCheckAgain}
                        className="w-full bg-gradient-to-r from-violet-600 to-purple-600"
                    >
                        Check Approval Status
                    </Button>

                    <Button
                        onClick={handleLogout}
                        variant="ghost"
                        className="w-full text-gray-400 hover:text-white"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                    </Button>
                </div>

                <p className="mt-8 text-sm text-gray-500">
                    Questions? Contact us at{" "}
                    <a href="mailto:support@adlunch.cloud" className="text-violet-400 hover:underline">
                        support@adlunch.cloud
                    </a>
                </p>
            </div>
        </div>
    );
}
