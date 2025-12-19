import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import type { Platform, Project } from '@/types';
import { Rocket, ArrowRight, Globe, DollarSign, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';

const markets = [
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'eu', label: 'European Union' },
  { value: 'global', label: 'Global' },
];

const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
];

const currencies = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
];

const platforms: { value: Platform; label: string; icon: string }[] = [
  { value: 'google', label: 'Google Ads', icon: '🔍' },
  { value: 'tiktok', label: 'TikTok Ads', icon: '🎵' },
  { value: 'snapchat', label: 'Snapchat Ads', icon: '👻' },
];

export default function NewProject() {
  const [name, setName] = useState('');
  const [market, setMarket] = useState('us');
  const [language, setLanguage] = useState('en');
  const [currency, setCurrency] = useState('USD');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const navigate = useNavigate();
  const { addProject } = useProjectStore();
  const { toast } = useToast();

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleCreate = async () => {
    if (!name) {
      toast({
        title: 'Project Name Required',
        description: 'Please enter a name for your project.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newProject: Project = {
        id: `project-${Date.now()}`,
        name,
        targetMarket: market,
        language,
        currency,
        defaultPlatforms: selectedPlatforms,
        createdAt: new Date().toISOString(),
        connections: [],
        stage: 'SETUP',
      };

      addProject(newProject);

      toast({
        title: 'Project Created!',
        description: 'Your project is ready. Connect your ad accounts to get started.',
      });

      navigate('/connections');
    } catch (error) {
      toast({
        title: 'Creation Failed',
        description: 'Failed to create project. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 top-0 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -right-1/4 bottom-0 h-96 w-96 rounded-full bg-success/5 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-lg border-border bg-card/80 backdrop-blur-xl animate-scale-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg">
            <Rocket className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Create New Project</CardTitle>
          <CardDescription>
            Set up your project to start launching AI-optimized ad campaigns.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              placeholder="Summer Sale 2024"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Market & Language */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Target Market</Label>
              <Select value={market} onValueChange={setMarket}>
                <SelectTrigger>
                  <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {markets.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <Languages className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map(l => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Currency */}
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default Platforms */}
          <div className="space-y-3">
            <Label>Default Platforms</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {platforms.map(platform => (
                <div
                  key={platform.value}
                  onClick={() => togglePlatform(platform.value)}
                  className={cn(
                    'cursor-pointer rounded-lg border p-3 text-center transition-all',
                    selectedPlatforms.includes(platform.value)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <span className="text-2xl">{platform.icon}</span>
                  <p className="mt-1 text-sm font-medium">{platform.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Create Button */}
          <Button
            onClick={handleCreate}
            disabled={isCreating || !name}
            className="w-full"
            size="lg"
            variant="glow"
          >
            {isCreating ? (
              'Creating...'
            ) : (
              <>
                Create Project
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
