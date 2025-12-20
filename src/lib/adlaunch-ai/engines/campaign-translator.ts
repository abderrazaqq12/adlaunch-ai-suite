import {
    CampaignIntent,
    Platform,
    AdAccountConnection,
    PLATFORM_OBJECTIVE_NAMES,
    Campaign
} from '../../types';
import { TranslatedCampaign } from '../types';

/**
 * 2️⃣ Campaign Translator (CRITICAL)
 * 
 * Maps generic CampaignIntent Intention to Platform-Specific API Structures.
 * Handles strict requirements per platform.
 */
export class CampaignTranslator {

    public static translate(
        intent: CampaignIntent,
        platform: Platform,
        account: AdAccountConnection
    ): TranslatedCampaign {
        switch (platform) {
            case 'google':
                return this.translateGoogle(intent, account);
            case 'tiktok':
                return this.translateTikTok(intent, account);
            case 'snapchat':
                return this.translateSnapchat(intent, account);
            default:
                throw new Error(`Unsupported platform for translation: ${platform}`);
        }
    }

    private static translateGoogle(intent: CampaignIntent, account: AdAccountConnection): TranslatedCampaign {
        // Google Ads - Demand Gen ONLY

        // Mapping Objectives
        // Intent: conversion -> Google: SALES / LEADS / WEBSITE_TRAFFIC (We'll use WEBSITE_TRAFFIC_CONVERSION for SaaS usually or SALES if strictly ecom, let's stick to generic conversion)
        // Actually prompt says: "conversion -> Sales / Website conversions"
        // "video_views -> Video engagement" (which is effectively Product & Brand Consideration in Google, but Demand Gen supports specific goals)

        let advertisingChannelType = 'DEMAND_GEN'; // Logical name, API might be DISCOVERY or MULTI_CHANNEL with specifics
        let start_date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Objective logic
        let objectiveType = 'WEBSITE_CONVERSION'; // Default
        if (intent.objective === 'video_views') {
            objectiveType = 'BRAND_AWARENESS_AND_REACH'; // Or CONSIDERATION
        } else {
            objectiveType = 'SALES'; // Prompt mapping
        }

        const campaignPayload = {
            customer_id: account.accountId,
            name: `${intent.name} - ${platformObjective(intent.objective, 'google')}`,
            status: 'PAUSED', // Always create paused initially for safety
            advertising_channel_type: advertisingChannelType,
            objective: objectiveType,
            campaign_budget: {
                amount_micros: intent.dailyBudget * 1000000,
                delivery_method: 'STANDARD'
            },
            target_spend: {
                cpc_bid_ceiling_micros: 2000000 // Default cap $2.00 just as placeholder safety
            },
            start_date: start_date,
            network_settings: {
                target_google_search: false,
                target_search_network: false,
                target_content_network: true // Demand Gen / Discovery runs here (Youtube, Gmail, Discover)
            },
            // Demand Gen specifics would go here
            demand_gen_settings: {
                // ...
            }
        };

        return {
            platform: 'google',
            campaign: campaignPayload
        };
    }

    private static translateTikTok(intent: CampaignIntent, account: AdAccountConnection): TranslatedCampaign {
        // TikTok Ads

        // Objectives: 
        // conversion -> CONVERSIONS
        // video_views -> VIDEO_VIEWS

        const objective = intent.objective === 'conversion' ? 'CONVERSIONS' : 'VIDEO_VIEWS';

        const campaignPayload = {
            advertiser_id: account.accountId,
            campaign_name: intent.name,
            objective_type: objective,
            budget_mode: 'BUDGET_MODE_DAY',
            budget: intent.dailyBudget,
            status: 'DISABLE', // Paused
            operation_status: 'DISABLE'
        };

        // TikTok AdGroup setup would be nested or separate, but for "Campaign" translator we return the campaign level mainly,
        // or the full structure if it's a "Launch Payload". 
        // The prompt says "A fully structured platform campaign specification".
        // I'll assume we include basic AdGroup structure implicit in the specification if possible or strictly the Campaign object.
        // Usually "Campaign" implies the top level object. But "Platform Campaign" might mean the full tree.
        // Let's add a `ad_groups` array placeholder to show intent.

        const optimizationGoal = intent.platformConfigs.tiktok?.optimizationEvent || 'CLICK'; // Default if missing

        return {
            platform: 'tiktok',
            campaign: {
                ...campaignPayload,
                ad_groups: [
                    {
                        adgroup_name: `${intent.name} - AdGroup`,
                        placement_type: 'PLACEMENT_TIKTOK',
                        location: intent.audience.countries,
                        age_groups: mapAgeToTikTok(intent.audience.ageMin, intent.audience.ageMax),
                        gender: intent.audience.gender === 'all' ? 'GENDER_UNLIMITED' : (intent.audience.gender === 'male' ? 'GENDER_MALE' : 'GENDER_FEMALE'),
                        optimization_goal: optimizationGoal,
                        billing_event: 'CPC', // simplified
                        bid_price: 1.0 // placeholder
                    }
                ]
            }
        };
    }

    private static translateSnapchat(intent: CampaignIntent, account: AdAccountConnection): TranslatedCampaign {
        // Snapchat Ads

        // Objectives:
        // conversion -> PIXEL_CONVERSIONS (WEB_VIEW)
        // video_views -> VIDEO_VIEWS

        const objective = intent.objective === 'conversion' ? 'PIXEL_CONVERSIONS' : 'VIDEO_VIEWS';

        const campaignPayload = {
            ad_account_id: account.accountId,
            name: intent.name,
            status: 'PAUSED',
            daily_budget_micro: intent.dailyBudget * 1000000,
            start_time: new Date().toISOString(),
            objective: objective
        };

        // Squads (AdSets)
        const adSquad = {
            name: `${intent.name} - Squad`,
            billing_event: 'IMPRESSION',
            bid_strategy: 'AUTO_BID',
            targeting: {
                geos: intent.audience.countries.map(c => ({ country_code: c })),
                demographics: {
                    age_min: intent.audience.ageMin,
                    age_max: intent.audience.ageMax, // Snapchat often uses strictly brackets, simplify here
                    gender: intent.audience.gender === 'all' ? 'ALL' : (intent.audience.gender === 'male' ? 'MALE' : 'FEMALE')
                }
            }
        };

        return {
            platform: 'snapchat',
            campaign: {
                ...campaignPayload,
                ad_squads: [adSquad]
            }
        };
    }
}

// Helpers

function platformObjective(objective: string, platform: Platform): string {
    return PLATFORM_OBJECTIVE_NAMES[platform][objective as keyof typeof PLATFORM_OBJECTIVE_NAMES['google']] || objective;
}

function mapAgeToTikTok(min: number, max: number): string[] {
    // TikTok uses: 'AGE_13_17', 'AGE_18_24', 'AGE_25_34', 'AGE_35_44', 'AGE_45_54', 'AGE_55+'
    // This is a naive mapper for the demo
    const risk = [];
    if (min <= 17) risk.push('AGE_13_17');
    if (min <= 24 && max >= 18) risk.push('AGE_18_24');
    if (min <= 34 && max >= 25) risk.push('AGE_25_34');
    if (min <= 44 && max >= 35) risk.push('AGE_35_44');
    if (min <= 54 && max >= 45) risk.push('AGE_45_54');
    if (max >= 55) risk.push('AGE_55_100');
    return risk.length > 0 ? risk : ['AGE_18_24'];
}
