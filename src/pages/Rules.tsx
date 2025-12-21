import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import type { AutomationRule, RuleCondition, RuleAction, RuleLevel, TimeRange } from '@/types';
import { 
  Zap, 
  Plus, 
  Trash2, 
  ArrowRight,
  Activity,
  DollarSign,
  Target,
  Layers,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const metrics = [
  { value: 'cpc', label: 'CPC', icon: DollarSign },
  { value: 'cpa', label: 'CPA', icon: Target },
  { value: 'ctr', label: 'CTR', icon: Activity },
  { value: 'roas', label: 'ROAS', icon: Activity },
  { value: 'impressions', label: 'Impressions', icon: Activity },
  { value: 'spend', label: 'Spend', icon: DollarSign },
];

const operators = [
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'gte', label: 'greater than or equal' },
  { value: 'lte', label: 'less than or equal' },
  { value: 'eq', label: 'equal to' },
];

const timeRanges = [
  { value: 'last_1_day', label: 'Last 1 day' },
  { value: 'last_3_days', label: 'Last 3 days' },
  { value: 'last_5_days', label: 'Last 5 days' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_14_days', label: 'Last 14 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
];

const levels = [
  { value: 'ad', label: 'Ad' },
  { value: 'adset', label: 'Ad Set' },
  { value: 'campaign', label: 'Campaign' },
];

const actions = [
  { value: 'pause', label: 'Pause' },
  { value: 'increase_budget', label: 'Increase budget by' },
  { value: 'decrease_budget', label: 'Decrease budget by' },
  { value: 'modify_creative', label: 'Modify creative' },
  { value: 'trigger_recovery', label: 'Trigger recovery engine' },
];

function RuleCard({ rule, onToggle, onDelete }: { 
  rule: AutomationRule; 
  onToggle: () => void;
  onDelete: () => void;
}) {
  const metricLabel = metrics.find(m => m.value === rule.condition.metric)?.label;
  const operatorLabel = operators.find(o => o.value === rule.condition.operator)?.label;
  const actionLabel = actions.find(a => a.value === rule.action.type)?.label;
  const timeRangeLabel = timeRanges.find(t => t.value === rule.condition.timeRange)?.label;
  const levelLabel = levels.find(l => l.value === rule.level)?.label;

  return (
    <Card className={cn(
      'border-border bg-card transition-all',
      !rule.enabled && 'opacity-60'
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'rounded-lg p-2',
                rule.enabled ? 'bg-primary/10' : 'bg-muted'
              )}>
                <Zap className={cn(
                  'h-5 w-5',
                  rule.enabled ? 'text-primary' : 'text-muted-foreground'
                )} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{rule.name}</p>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                    {levelLabel}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {rule.enabled ? 'Active' : 'Disabled'}
                </p>
              </div>
            </div>

            {/* Rule Logic Display */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/50 p-3">
              <span className="text-sm font-medium text-primary">IF</span>
              <span className="rounded bg-muted px-2 py-1 text-sm text-foreground">
                {metricLabel}
              </span>
              <span className="rounded bg-accent/50 px-2 py-1 text-sm text-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeRangeLabel}
              </span>
              <span className="text-sm text-muted-foreground">{operatorLabel}</span>
              <span className="rounded bg-muted px-2 py-1 text-sm text-foreground">
                {rule.condition.value}
              </span>
              {rule.condition.afterImpressions && (
                <>
                  <span className="text-sm text-muted-foreground">after</span>
                  <span className="rounded bg-muted px-2 py-1 text-sm text-foreground">
                    {rule.condition.afterImpressions.toLocaleString()} impressions
                  </span>
                </>
              )}
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-success">THEN</span>
              <span className="rounded bg-success/10 px-2 py-1 text-sm text-success">
                {actionLabel} {levelLabel?.toLowerCase()}
                {rule.action.value && ` ${rule.action.value}%`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={rule.enabled} onCheckedChange={onToggle} />
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Rules() {
  const [isCreating, setIsCreating] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    level: 'ad' as RuleLevel,
    metric: 'cpc',
    operator: 'gt',
    timeRange: 'last_7_days' as TimeRange,
    value: '',
    afterImpressions: '',
    actionType: 'pause',
    actionValue: '',
  });
  
  const { rules, addRule, updateRule, removeRule, currentProject } = useProjectStore();
  const { toast } = useToast();

  const projectRules = rules.filter(r => r.projectId === currentProject?.id);

  const handleCreateRule = () => {
    if (!newRule.name || !newRule.value || !currentProject) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const rule: AutomationRule = {
      id: `rule-${Date.now()}`,
      projectId: currentProject.id,
      name: newRule.name,
      enabled: true,
      level: newRule.level,
      condition: {
        metric: newRule.metric as RuleCondition['metric'],
        operator: newRule.operator as RuleCondition['operator'],
        value: parseFloat(newRule.value),
        timeRange: newRule.timeRange,
        afterImpressions: newRule.afterImpressions ? parseInt(newRule.afterImpressions) : undefined,
      },
      action: {
        type: newRule.actionType as RuleAction['type'],
        value: newRule.actionValue ? parseFloat(newRule.actionValue) : undefined,
      },
      createdAt: new Date().toISOString(),
    };

    addRule(rule);
    
    toast({
      title: 'Rule Created',
      description: 'Your automation rule is now active.',
    });

    // Reset form
    setIsCreating(false);
    setNewRule({
      name: '',
      level: 'ad',
      metric: 'cpc',
      operator: 'gt',
      timeRange: 'last_7_days',
      value: '',
      afterImpressions: '',
      actionType: 'pause',
      actionValue: '',
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rules & Automation</h1>
          <p className="mt-1 text-muted-foreground">
            Create IF/THEN rules to automate campaign optimization.
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} variant="glow">
          <Plus className="mr-2 h-4 w-4" />
          Create Rule
        </Button>
      </div>

      {/* Create Rule Form */}
      {isCreating && (
        <Card className="border-primary/20 bg-card">
          <CardHeader>
            <CardTitle>Create New Rule</CardTitle>
            <CardDescription>
              Define conditions and actions for automated optimization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ruleName">Rule Name</Label>
                <Input
                  id="ruleName"
                  placeholder="High CPA Alert"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Apply to Level</Label>
                <Select
                  value={newRule.level}
                  onValueChange={(v) => setNewRule({ ...newRule, level: v as RuleLevel })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map(l => (
                      <SelectItem key={l.value} value={l.value}>
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          {l.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg bg-secondary/30 p-4 space-y-4">
              <p className="text-sm font-medium text-primary">IF Condition</p>
              
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Metric</Label>
                  <Select
                    value={newRule.metric}
                    onValueChange={(v) => setNewRule({ ...newRule, metric: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {metrics.map(m => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Time Range</Label>
                  <Select
                    value={newRule.timeRange}
                    onValueChange={(v) => setNewRule({ ...newRule, timeRange: v as TimeRange })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeRanges.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {t.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Operator</Label>
                  <Select
                    value={newRule.operator}
                    onValueChange={(v) => setNewRule({ ...newRule, operator: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map(o => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input
                    type="number"
                    placeholder="7.00"
                    value={newRule.value}
                    onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>After Impressions (Optional)</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={newRule.afterImpressions}
                  onChange={(e) => setNewRule({ ...newRule, afterImpressions: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-lg bg-success/5 p-4 space-y-4">
              <p className="text-sm font-medium text-success">THEN Action</p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Action Type</Label>
                  <Select
                    value={newRule.actionType}
                    onValueChange={(v) => setNewRule({ ...newRule, actionType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {actions.map(a => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(newRule.actionType === 'increase_budget' || newRule.actionType === 'decrease_budget') && (
                  <div className="space-y-2">
                    <Label>Percentage</Label>
                    <Input
                      type="number"
                      placeholder="20"
                      value={newRule.actionValue}
                      onChange={(e) => setNewRule({ ...newRule, actionValue: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRule}>
                Create Rule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Rules */}
      {projectRules.length > 0 ? (
        <div className="space-y-4">
          {projectRules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={() => updateRule(rule.id, { enabled: !rule.enabled })}
              onDelete={() => removeRule(rule.id)}
            />
          ))}
        </div>
      ) : !isCreating && (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4">
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mt-4 text-lg font-medium text-foreground">No Rules Created</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first automation rule to optimize campaigns automatically.
            </p>
            <Button onClick={() => setIsCreating(true)} className="mt-4" variant="glow">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Rule
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
