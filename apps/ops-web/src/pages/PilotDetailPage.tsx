import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  MetricCard,
  PageFrame,
  PageHeader,
  SectionCard,
  StatePanel,
} from '../components/ConsoleUi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NewPilotFeedbackSection,
  PilotFeedbackSection,
  type PilotDetailFeedbackRow,
} from './pilot-detail-sections';
import { supportFetch } from '../lib/support-console-fetch';

type BranchRow = { id: string; name: string; slug: string };

type FeedbackListResponse = { items?: PilotDetailFeedbackRow[] };
type Notice = { title: string; description: string; variant: 'info' | 'success' };
type TaskState = 'refresh' | 'feedback' | 'onboarding' | 'submit' | 'triage' | null;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function countItems(value: unknown): number | null {
  if (Array.isArray(value)) {
    return value.length;
  }
  const record = asRecord(value);
  return record ? Object.keys(record).length : null;
}

export function PilotDetailPage() {
  const { tenantId = '' } = useParams<{ tenantId: string }>();
  const supportOperator = '';
  const [summary, setSummary] = useState<unknown>(null);
  const [branches, setBranches] = useState<BranchRow[] | null>(null);
  const [feedback, setFeedback] = useState<FeedbackListResponse | null>(null);
  const [onboardingBranchId, setOnboardingBranchId] = useState('');
  const [onboardingOut, setOnboardingOut] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [task, setTask] = useState<TaskState>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [feedbackType, setFeedbackType] = useState<string>('bug');
  const [severity, setSeverity] = useState<string>('sev3');
  const [moduleTag, setModuleTag] = useState('');
  const [blastRadius, setBlastRadius] = useState('');
  const [evidenceQuality, setEvidenceQuality] = useState<string>('verbal_only');
  const [requestId, setRequestId] = useState('');
  const [branchIdFb, setBranchIdFb] = useState('');
  const [externalIncidentUrl, setExternalIncidentUrl] = useState('');
  const [promoted, setPromoted] = useState(false);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPromoted, setFilterPromoted] = useState('');

  const [triageEditId, setTriageEditId] = useState<string | null>(null);
  const [triageStatus, setTriageStatus] = useState('open');
  const [triageTheme, setTriageTheme] = useState('');
  const [triageCritical, setTriageCritical] = useState(false);
  const [triageNotesText, setTriageNotesText] = useState('');

  const op = useMemo(() => ({ supportOperator }), [supportOperator]);

  const loadFeedbackList = useCallback(
    async (mode: TaskState = 'feedback') => {
      const tid = tenantId.trim();
      if (!tid) {
        return;
      }
      if (mode) {
        setTask(mode);
      }
      setErr(null);
      try {
        const query = new URLSearchParams();
        query.set('limit', '100');
        if (filterStatus) {
          query.set('status', filterStatus);
        }
        if (filterType) {
          query.set('feedbackType', filterType);
        }
        if (filterPromoted === 'yes') {
          query.set('promotedToEngineering', 'true');
        }
        if (filterPromoted === 'no') {
          query.set('promotedToEngineering', 'false');
        }
        const data = (await supportFetch(
          `/support/tenants/${tid}/pilot-feedback?${query.toString()}`,
        )) as FeedbackListResponse;
        setFeedback(data);
      } catch (error) {
        setErr(error instanceof Error ? error.message : String(error));
      } finally {
        if (mode) {
          setTask(null);
        }
      }
    },
    [filterPromoted, filterStatus, filterType, tenantId],
  );

  const loadAll = useCallback(async () => {
    const tid = tenantId.trim();
    if (!tid) {
      return;
    }
    setTask('refresh');
    setErr(null);
    setNotice(null);
    try {
      const query = new URLSearchParams();
      query.set('limit', '100');
      const [summaryData, branchesData, feedbackData] = await Promise.all([
        supportFetch(`/support/tenants/${tid}/summary`),
        supportFetch(`/support/tenants/${tid}/branches`),
        supportFetch(`/support/tenants/${tid}/pilot-feedback?${query.toString()}`),
      ]);
      setSummary(summaryData);
      setBranches(Array.isArray(branchesData) ? (branchesData as BranchRow[]) : []);
      setFeedback((feedbackData as FeedbackListResponse) ?? { items: [] });
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      setTask(null);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const submitFeedback = useCallback(async () => {
    const tid = tenantId.trim();
    if (!tid || !title.trim() || !description.trim()) {
      return;
    }
    setTask('submit');
    setErr(null);
    setNotice(null);
    try {
      const body: Record<string, unknown> = {
        feedbackType,
        severity,
        title: title.trim(),
        description: description.trim(),
        evidenceQuality,
        promotedToEngineering: promoted,
      };
      if (moduleTag.trim()) {
        body.moduleTag = moduleTag.trim();
      }
      if (blastRadius.trim()) {
        body.blastRadius = blastRadius.trim();
      }
      if (requestId.trim()) {
        body.requestId = requestId.trim();
      }
      if (branchIdFb.trim()) {
        body.branchId = branchIdFb.trim();
      }
      if (externalIncidentUrl.trim()) {
        body.externalIncidentUrl = externalIncidentUrl.trim();
      }

      await supportFetch(
        `/support/tenants/${tid}/pilot-feedback`,
        { method: 'POST', body: JSON.stringify(body) },
        op,
      );
      setTitle('');
      setDescription('');
      setModuleTag('');
      setBlastRadius('');
      setRequestId('');
      setBranchIdFb('');
      setExternalIncidentUrl('');
      setPromoted(false);
      await loadFeedbackList(null);
      setNotice({
        variant: 'success',
        title: 'Feedback submitted',
        description: 'The structured pilot item was recorded and the feedback queue was refreshed.',
      });
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      setTask(null);
    }
  }, [
    blastRadius,
    branchIdFb,
    description,
    evidenceQuality,
    externalIncidentUrl,
    feedbackType,
    loadFeedbackList,
    moduleTag,
    op,
    promoted,
    requestId,
    severity,
    tenantId,
    title,
  ]);

  const startTriage = useCallback((row: PilotDetailFeedbackRow) => {
    setTriageEditId(row.id);
    setTriageStatus(row.status);
    setTriageTheme(row.themeKey ?? '');
    setTriageCritical(row.businessCritical);
    setTriageNotesText(row.triageNotes ?? '');
  }, []);

  const saveTriage = useCallback(async () => {
    const tid = tenantId.trim();
    if (!tid || !triageEditId) {
      return;
    }
    setTask('triage');
    setErr(null);
    setNotice(null);
    try {
      await supportFetch(
        `/support/tenants/${tid}/pilot-feedback/${triageEditId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: triageStatus,
            themeKey: triageTheme.trim() || undefined,
            businessCritical: triageCritical,
            triageNotes: triageNotesText.trim() || undefined,
          }),
        },
        op,
      );
      setTriageEditId(null);
      await loadFeedbackList(null);
      setNotice({
        variant: 'success',
        title: 'Triage saved',
        description: 'The feedback item was updated and the filtered queue was refreshed.',
      });
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      setTask(null);
    }
  }, [
    loadFeedbackList,
    op,
    tenantId,
    triageCritical,
    triageEditId,
    triageNotesText,
    triageStatus,
    triageTheme,
  ]);

  const loadOnboarding = useCallback(async () => {
    const tid = tenantId.trim();
    const branchId = onboardingBranchId.trim();
    if (!tid || !branchId) {
      return;
    }
    setTask('onboarding');
    setErr(null);
    setNotice(null);
    try {
      const data = await supportFetch(
        `/support/tenants/${tid}/branches/${encodeURIComponent(branchId)}/onboarding-status`,
      );
      setOnboardingOut(data);
      setNotice({
        variant: 'info',
        title: 'Onboarding snapshot loaded',
        description: `Fetched onboarding status for branch ${branchId}.`,
      });
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      setTask(null);
    }
  }, [onboardingBranchId, tenantId]);

  const feedbackItems = feedback?.items ?? [];
  const summaryRecord = asRecord(summary);
  const pilotRecord = asRecord(summaryRecord?.pilot);
  const commercialRecord = asRecord(summaryRecord?.commercial);
  const effectiveLimitsRecord = asRecord(commercialRecord?.effectiveLimits);

  const branchCount = branches?.length ?? 0;
  const feedbackCount = readNumber(summaryRecord?.pilotFeedbackCount) ?? feedbackItems.length;
  const healthValue =
    readString(pilotRecord?.pilotHealth) ??
    readString(pilotRecord?.venueStatus) ??
    readString(pilotRecord?.pilotPhase) ??
    'Unknown';
  const featureCount = countItems(effectiveLimitsRecord?.features) ?? 0;

  const loadingTitle =
    task === 'refresh'
      ? 'Refreshing pilot detail'
      : task === 'feedback'
        ? 'Refreshing feedback queue'
        : task === 'onboarding'
          ? 'Loading onboarding snapshot'
          : task === 'submit'
            ? 'Submitting feedback'
            : task === 'triage'
              ? 'Saving triage'
              : 'Loading';

  return (
    <PageFrame size="wide">
      <PageHeader
        eyebrow="Pilot operations"
        title="Pilot detail"
        description="Internal pilot console for tenant summary, onboarding checks, and structured feedback triage."
        status={
          <>
            <Badge variant="outline" className="text-xs">
              Tenant <span className="ml-1 font-mono">{tenantId}</span>
            </Badge>
            <Badge variant="outline" className="text-xs">
              Operator <span className="ml-1 font-mono">{supportOperator || "--"}</span>
            </Badge>
          </>
        }
        actions={
          <Button type="button" disabled={task !== null} onClick={() => void loadAll()}>
            Reload summary & feedback
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tenant" value={tenantId || '--'} detail="Internal pilot tenant id" />
        <MetricCard
          label="Branches"
          value={branches ? branchCount : '--'}
          detail="Branches attached to this tenant"
          tone={branchCount > 0 ? 'emerald' : 'default'}
        />
        <MetricCard
          label="Feedback items"
          value={feedback ? feedbackCount : '--'}
          detail="Structured pilot feedback rows"
          tone={feedbackCount > 0 ? 'amber' : 'default'}
        />
        <MetricCard
          label="Pilot health"
          value={healthValue}
          detail={featureCount > 0 ? `${featureCount} feature flags in effective limits` : 'Commercial limits not parsed'}
          tone={healthValue.toLowerCase() === 'green' ? 'emerald' : 'default'}
        />
      </div>

      {task ? (
        <StatePanel
          className="mb-6"
          compact
          variant="loading"
          title={loadingTitle}
          description="Working with support APIs through the secured server-side gateway."
        />
      ) : null}

      {err ? (
        <StatePanel
          className="mb-6"
          variant="error"
          title="Pilot detail request failed"
          description={err}
        />
      ) : null}

      {notice ? (
        <StatePanel
          className="mb-6"
          variant={notice.variant}
          title={notice.title}
          description={notice.description}
        />
      ) : null}

      <div className="space-y-6">
        <SectionCard
          title="Tenant summary"
          description="Summary includes pilot metadata, onboarding rollup, commercial limits, and pilot feedback counts."
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Health"
              value={readString(pilotRecord?.pilotHealth) ?? '--'}
              detail="pilot.pilotHealth"
              tone={readString(pilotRecord?.pilotHealth) === 'green' ? 'emerald' : 'default'}
            />
            <MetricCard
              label="Venue status"
              value={readString(pilotRecord?.venueStatus) ?? '--'}
              detail="pilot.venueStatus"
            />
            <MetricCard
              label="Feature flags"
              value={featureCount || '--'}
              detail="commercial.effectiveLimits.features"
            />
          </div>

          {summary ? (
            <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-[22px] border border-white/8 bg-black/15 p-4 text-xs text-slate-300">
              {JSON.stringify(summary, null, 2)}
            </pre>
          ) : (
            <StatePanel
              compact
              variant="empty"
              title="No summary loaded"
              description="Reload the pilot detail once your authenticated support session is active."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Branches & onboarding"
          description="Use this panel to inspect branch coverage and fetch onboarding status for a single branch."
          actions={
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-[220px] flex-1 font-mono text-sm"
                value={onboardingBranchId}
                onChange={(event) => setOnboardingBranchId(event.target.value)}
                placeholder="branch id"
              />
              <Button
                type="button"
                variant="outline"
                disabled={task !== null || !onboardingBranchId.trim()}
                onClick={() => void loadOnboarding()}
              >
                Load onboarding status
              </Button>
            </div>
          }
        >
          {branches && branches.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className="rounded-[22px] border border-white/8 bg-black/10 p-4"
                >
                  <div className="font-medium text-slate-100">{branch.name}</div>
                  <div className="mt-1 font-mono text-xs text-slate-500">{branch.id}</div>
                  <div className="mt-2 text-sm text-slate-400">{branch.slug}</div>
                </div>
              ))}
            </div>
          ) : (
            <StatePanel
              compact
              variant="empty"
              title="No branches loaded"
              description="Reload the tenant summary to pull branch ids before checking onboarding status."
            />
          )}

          {onboardingOut ? (
            <details className="mt-4 rounded-[22px] border border-white/8 bg-black/10 p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-300">
                Latest onboarding payload
              </summary>
              <pre className="mt-3 max-h-[280px] overflow-auto whitespace-pre-wrap text-xs text-slate-400">
                {JSON.stringify(onboardingOut, null, 2)}
              </pre>
            </details>
          ) : null}
        </SectionCard>

        <PilotFeedbackSection
          feedbackItems={feedbackItems}
          filterStatus={filterStatus}
          filterType={filterType}
          filterPromoted={filterPromoted}
          task={task}
          triageEditId={triageEditId}
          triageStatus={triageStatus}
          triageTheme={triageTheme}
          triageCritical={triageCritical}
          triageNotesText={triageNotesText}
          setFilterStatus={setFilterStatus}
          setFilterType={setFilterType}
          setFilterPromoted={setFilterPromoted}
          loadFeedbackList={() => loadFeedbackList('feedback')}
          startTriage={startTriage}
          setTriageStatus={setTriageStatus}
          setTriageTheme={setTriageTheme}
          setTriageCritical={setTriageCritical}
          setTriageNotesText={setTriageNotesText}
          saveTriage={saveTriage}
          cancelTriage={() => setTriageEditId(null)}
        />

        <NewPilotFeedbackSection
          task={task}
          title={title}
          description={description}
          feedbackType={feedbackType}
          severity={severity}
          moduleTag={moduleTag}
          blastRadius={blastRadius}
          evidenceQuality={evidenceQuality}
          requestId={requestId}
          branchIdFb={branchIdFb}
          externalIncidentUrl={externalIncidentUrl}
          promoted={promoted}
          setTitle={setTitle}
          setDescription={setDescription}
          setFeedbackType={setFeedbackType}
          setSeverity={setSeverity}
          setModuleTag={setModuleTag}
          setBlastRadius={setBlastRadius}
          setEvidenceQuality={setEvidenceQuality}
          setRequestId={setRequestId}
          setBranchIdFb={setBranchIdFb}
          setExternalIncidentUrl={setExternalIncidentUrl}
          setPromoted={setPromoted}
          submitFeedback={submitFeedback}
        />
      </div>
    </PageFrame>
  );
}
