import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import type { Asset, Platform } from '@/types';
import { 
  Upload, 
  Video, 
  FileText, 
  Link2, 
  Plus, 
  Trash2, 
  Tag,
  Image,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const tagOptions = {
  hook: ['Curiosity', 'Urgency', 'Social Proof', 'Fear', 'Authority'],
  emotion: ['Excited', 'Happy', 'Inspired', 'Relaxed', 'Motivated'],
  offer: ['Discount', 'Free Trial', 'Limited Time', 'Bonus', 'Guarantee'],
};

const platformOptions: Platform[] = ['google', 'tiktok', 'snapchat'];

export default function Assets() {
  const [activeTab, setActiveTab] = useState('videos');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [textContent, setTextContent] = useState('');
  const [landingUrl, setLandingUrl] = useState('');
  
  const { assets, addAsset, removeAsset, currentProject } = useProjectStore();
  const { toast } = useToast();

  const projectAssets = assets.filter(a => a.projectId === currentProject?.id);
  const videoAssets = projectAssets.filter(a => a.type === 'video');
  const textAssets = projectAssets.filter(a => a.type === 'text');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'image') => {
    const files = e.target.files;
    if (!files || !currentProject) return;

    Array.from(files).forEach(file => {
      const newAsset: Asset = {
        id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        projectId: currentProject.id,
        type,
        name: file.name,
        url: URL.createObjectURL(file),
        tags: selectedTags.map(t => ({ type: 'hook', value: t })),
        platforms: selectedPlatforms,
        createdAt: new Date().toISOString(),
      };
      addAsset(newAsset);
    });

    toast({
      title: 'Assets Uploaded',
      description: `Successfully uploaded ${files.length} file(s).`,
    });

    // Reset
    setSelectedTags([]);
    setSelectedPlatforms([]);
  };

  const handleAddText = () => {
    if (!textContent || !currentProject) return;

    const newAsset: Asset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId: currentProject.id,
      type: 'text',
      name: textContent.substring(0, 50) + (textContent.length > 50 ? '...' : ''),
      content: textContent,
      tags: selectedTags.map(t => ({ type: 'hook', value: t })),
      platforms: selectedPlatforms,
      createdAt: new Date().toISOString(),
    };
    addAsset(newAsset);

    toast({
      title: 'Text Variation Added',
      description: 'Your ad copy has been saved.',
    });

    setTextContent('');
    setSelectedTags([]);
    setSelectedPlatforms([]);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Asset Manager</h1>
        <p className="mt-1 text-muted-foreground">
          Upload and manage your creative assets for ad campaigns.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="videos" className="gap-2">
            <Video className="h-4 w-4" />
            Videos ({videoAssets.length})
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-2">
            <FileText className="h-4 w-4" />
            Ad Copy ({textAssets.length})
          </TabsTrigger>
          <TabsTrigger value="landing" className="gap-2">
            <Link2 className="h-4 w-4" />
            Landing Pages
          </TabsTrigger>
        </TabsList>

        {/* Video Assets Tab */}
        <TabsContent value="videos" className="mt-6 space-y-6">
          {/* Upload Section */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Upload Video Ads</CardTitle>
              <CardDescription>
                Upload multiple video files to use in your campaigns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tag Selection */}
              <div className="space-y-3">
                <Label>Tags (Optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(tagOptions).map(([category, tags]) => (
                    tags.map(tag => (
                      <Badge
                        key={tag}
                        variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))
                  ))}
                </div>
              </div>

              {/* Platform Selection */}
              <div className="space-y-3">
                <Label>Target Platforms</Label>
                <div className="flex gap-2">
                  {platformOptions.map(platform => (
                    <Badge
                      key={platform}
                      variant={selectedPlatforms.includes(platform) ? 'default' : 'outline'}
                      className={cn(
                        'cursor-pointer capitalize',
                        selectedPlatforms.includes(platform) && (
                          platform === 'google' ? 'bg-google' :
                          platform === 'tiktok' ? 'bg-gradient-to-r from-tiktok to-tiktok-pink' :
                          'bg-snapchat text-black'
                        )
                      )}
                      onClick={() => togglePlatform(platform)}
                    >
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Upload Area */}
              <div className="relative">
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={(e) => handleFileUpload(e, 'video')}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-12 transition-colors hover:border-primary/50 hover:bg-muted/50">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-4 font-medium text-foreground">
                    Drop video files here or click to upload
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    MP4, MOV, or WebM up to 500MB each
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Asset Grid */}
          {videoAssets.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videoAssets.map(asset => (
                <Card key={asset.id} className="border-border bg-card overflow-hidden">
                  <div className="aspect-video bg-muted">
                    {asset.url && (
                      <video 
                        src={asset.url} 
                        className="h-full w-full object-cover"
                        controls
                      />
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 truncate">
                        <p className="truncate font-medium text-foreground">{asset.name}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {asset.platforms.map(p => (
                            <Badge key={p} variant="secondary" className="text-xs capitalize">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeAsset(asset.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Text Assets Tab */}
        <TabsContent value="text" className="mt-6 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Add Ad Copy Variations</CardTitle>
              <CardDescription>
                Create multiple text variations for A/B testing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="adCopy">Ad Copy</Label>
                <Textarea
                  id="adCopy"
                  placeholder="Enter your ad headline and description..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Tag Selection */}
              <div className="space-y-3">
                <Label>Tags (Optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(tagOptions).map(([category, tags]) => (
                    tags.map(tag => (
                      <Badge
                        key={tag}
                        variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))
                  ))}
                </div>
              </div>

              <Button onClick={handleAddText} disabled={!textContent}>
                <Plus className="mr-2 h-4 w-4" />
                Add Variation
              </Button>
            </CardContent>
          </Card>

          {/* Text Assets List */}
          {textAssets.length > 0 && (
            <div className="space-y-4">
              {textAssets.map(asset => (
                <Card key={asset.id} className="border-border bg-card">
                  <CardContent className="flex items-start justify-between p-4">
                    <div className="flex-1">
                      <p className="text-foreground">{asset.content}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {asset.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag.value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeAsset(asset.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Landing Pages Tab */}
        <TabsContent value="landing" className="mt-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Landing Page URLs</CardTitle>
              <CardDescription>
                Add destination URLs for your ad campaigns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="landingUrl">Landing Page URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="landingUrl"
                    type="url"
                    placeholder="https://yoursite.com/landing"
                    value={landingUrl}
                    onChange={(e) => setLandingUrl(e.target.value)}
                  />
                  <Button disabled={!landingUrl}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
