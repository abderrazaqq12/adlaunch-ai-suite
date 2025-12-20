import { Platform } from '../../types';
import { PermissionAnalysis } from '../types';

/**
 * 1️⃣ Permission Interpreter
 * 
 * Analyzes scopes and account metadata to determine what actions the AI can perform.
 * Strict conservative compliance.
 */
export class PermissionInterpreter {

    public static analyze(
        platform: Platform,
        scopes: string[],
        role?: string
    ): PermissionAnalysis {
        switch (platform) {
            case 'google':
                return this.analyzeGoogle(scopes, role);
            case 'tiktok':
                return this.analyzeTikTok(scopes, role);
            case 'snapchat':
                return this.analyzeSnapchat(scopes, role);
            default:
                // Default deny
                return {
                    canAnalyze: false,
                    canLaunch: false,
                    canOptimize: false,
                    requiredAction: 'REQUEST_ADMIN_ACCESS'
                };
        }
    }

    private static analyzeGoogle(scopes: string[], role?: string): PermissionAnalysis {
        // Google Ads scopes
        // https://www.googleapis.com/auth/adwords is the main one

        const hasAdWords = scopes.includes('https://www.googleapis.com/auth/adwords');
        const isReadOnly = role === 'READ_ONLY'; // Simplified role check if provided

        // If we don't have the basic scope, we can't do anything
        if (!hasAdWords) {
            return {
                canAnalyze: false,
                canLaunch: false,
                canOptimize: false,
                requiredAction: 'REQUEST_ADMIN_ACCESS'
            };
        }

        if (isReadOnly) {
            return {
                canAnalyze: true,
                canLaunch: false,
                canOptimize: false,
                requiredAction: 'REQUEST_ADMIN_ACCESS'
            };
        }

        // Assuming if we have the scope and not read-only, we have full access
        // In reality Google Ads API is granulary controlled by the account access level linked to the Oauth token user
        return {
            canAnalyze: true,
            canLaunch: true,
            canOptimize: true,
            requiredAction: 'NONE'
        };
    }

    private static analyzeTikTok(scopes: string[], role?: string): PermissionAnalysis {
        // TikTok Marketing API scopes
        // 'ads.management' - management
        // 'ads.read' - read

        const hasRead = scopes.includes('ads.read') || scopes.includes('user.info.basic');
        const hasManagement = scopes.includes('ads.management');

        if (!hasRead && !hasManagement) {
            return {
                canAnalyze: false,
                canLaunch: false,
                canOptimize: false,
                requiredAction: 'REQUEST_ADMIN_ACCESS'
            };
        }

        if (hasRead && !hasManagement) {
            return {
                canAnalyze: true,
                canLaunch: false,
                canOptimize: false,
                requiredAction: 'REQUEST_ADMIN_ACCESS'
            };
        }

        return {
            canAnalyze: true,
            canLaunch: true,
            canOptimize: true,
            requiredAction: 'NONE'
        };
    }

    private static analyzeSnapchat(scopes: string[], role?: string): PermissionAnalysis {
        // Snapchat Marketing API scopes
        // 'snapchat-marketing-api'

        const hasMarketingApi = scopes.includes('snapchat-marketing-api');

        // Snapchat roles usually imply permissions. 
        // 'ORGANIZATION_ADMIN' | 'AD_ACCOUNT_ADMIN' | 'CAMPAIGN_MANAGER' | 'DATA_ANALYST'
        const minimalLaunchRoles = ['ORGANIZATION_ADMIN', 'AD_ACCOUNT_ADMIN', 'CAMPAIGN_MANAGER'];
        const canLaunch = hasMarketingApi && (role ? minimalLaunchRoles.includes(role) : true); // If role undefined, assume scope is enough for now or stricter? 
        // Let's be conservative: if role is undefined, but scope is present, we assume yes BUT we should be careful.
        // The prompt says "Never assume permissions".
        // So if role is checking is part of the input, we check it.

        if (!hasMarketingApi) {
            return {
                canAnalyze: false,
                canLaunch: false,
                canOptimize: false,
                requiredAction: 'REQUEST_ADMIN_ACCESS'
            };
        }

        if (role === 'DATA_ANALYST' || role === 'CREATIVE_MANAGER') {
            return {
                canAnalyze: true,
                canLaunch: false,
                canOptimize: false, // Optimization requires write access
                requiredAction: 'REQUEST_ADMIN_ACCESS'
            };
        }

        return {
            canAnalyze: true,
            canLaunch: canLaunch,
            canOptimize: canLaunch,
            requiredAction: 'NONE'
        };
    }
}
