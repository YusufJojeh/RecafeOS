import { SectionCard, StatePanel } from '../components/ConsoleUi';
import { Button } from '@/components/ui/button';
import {
  PILOT_EVIDENCE_QUALITY,
  PILOT_FEEDBACK_SEVERITIES,
  PILOT_FEEDBACK_STATUS,
  PILOT_FEEDBACK_TYPES,
} from '../lib/pilot-feedback-taxonomy';

export type PilotDetailFeedbackRow = {
  id: string;
  feedbackType: string;
  severity: string;
  status: string;
  themeKey: string | null;
  businessCritical: boolean;
  triageNotes: string | null;
  title: string;
  promotedToEngineering: boolean;
};

type PilotFeedbackSectionProps = {
  feedbackItems: PilotDetailFeedbackRow[];
  filterStatus: string;
  filterType: string;
  filterPromoted: string;
  task: string | null;
  triageEditId: string | null;
  triageStatus: string;
  triageTheme: string;
  triageCritical: boolean;
  triageNotesText: string;
  setFilterStatus: (value: string) => void;
  setFilterType: (value: string) => void;
  setFilterPromoted: (value: string) => void;
  loadFeedbackList: () => void | Promise<void>;
  startTriage: (row: PilotDetailFeedbackRow) => void;
  setTriageStatus: (value: string) => void;
  setTriageTheme: (value: string) => void;
  setTriageCritical: (value: boolean) => void;
  setTriageNotesText: (value: string) => void;
  saveTriage: () => void | Promise<void>;
  cancelTriage: () => void;
};

type NewPilotFeedbackSectionProps = {
  task: string | null;
  title: string;
  description: string;
  feedbackType: string;
  severity: string;
  moduleTag: string;
  blastRadius: string;
  evidenceQuality: string;
  requestId: string;
  branchIdFb: string;
  externalIncidentUrl: string;
  promoted: boolean;
  setTitle: (value: string) => void;
  setDescription: (value: string) => void;
  setFeedbackType: (value: string) => void;
  setSeverity: (value: string) => void;
  setModuleTag: (value: string) => void;
  setBlastRadius: (value: string) => void;
  setEvidenceQuality: (value: string) => void;
  setRequestId: (value: string) => void;
  setBranchIdFb: (value: string) => void;
  setExternalIncidentUrl: (value: string) => void;
  setPromoted: (value: boolean) => void;
  submitFeedback: () => void | Promise<void>;
};

export function PilotFeedbackSection({
  feedbackItems,
  filterStatus,
  filterType,
  filterPromoted,
  task,
  triageEditId,
  triageStatus,
  triageTheme,
  triageCritical,
  triageNotesText,
  setFilterStatus,
  setFilterType,
  setFilterPromoted,
  loadFeedbackList,
  startTriage,
  setTriageStatus,
  setTriageTheme,
  setTriageCritical,
  setTriageNotesText,
  saveTriage,
  cancelTriage,
}: PilotFeedbackSectionProps) {
  return (
    <SectionCard
      title="Pilot feedback (structured)"
      description="Filter the queue, triage items into themes, and keep internal operators aligned on what needs product or engineering action."
    >
      <div className="mb-4 grid gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <label className="text-sm">
          <span className="text-slate-400">Status</span>
          <select
            className="mt-2 block w-full px-4 py-3 text-sm"
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
          >
            <option value="">Any</option>
            {PILOT_FEEDBACK_STATUS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-400">Type</span>
          <select
            className="mt-2 block w-full px-4 py-3 text-sm"
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
          >
            <option value="">Any</option>
            {PILOT_FEEDBACK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-400">Promoted</span>
          <select
            className="mt-2 block w-full px-4 py-3 text-sm"
            value={filterPromoted}
            onChange={(event) => setFilterPromoted(event.target.value)}
          >
            <option value="">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button type="button" variant="outline" className="w-full" disabled={task !== null} onClick={() => void loadFeedbackList()}>
            Apply filters
          </Button>
        </div>
      </div>

      {feedbackItems.length > 0 ? (
        <div className="overflow-x-auto rounded-[22px] border border-white/8 bg-black/10">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-white/8 bg-white/4 text-slate-400">
              <tr>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Severity</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Theme</th>
                <th className="px-3 py-3 font-medium">Promoted</th>
                <th className="px-3 py-3 font-medium">Title</th>
                <th className="px-3 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {feedbackItems.map((row) => (
                <tr key={row.id} className="border-b border-white/8 last:border-b-0">
                  <td className="px-3 py-3 text-slate-300">{row.feedbackType}</td>
                  <td className="px-3 py-3 text-slate-300">{row.severity}</td>
                  <td className="px-3 py-3 text-slate-300">{row.status}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-500">
                    {row.themeKey ?? '--'}
                  </td>
                  <td className="px-3 py-3 text-slate-300">
                    {row.promotedToEngineering ? 'Yes' : 'No'}
                  </td>
                  <td className="max-w-[260px] px-3 py-3 text-slate-200">{row.title}</td>
                  <td className="px-3 py-3">
                    <Button type="button" variant="link" className="px-0 text-emerald-200" onClick={() => startTriage(row)}>
                      Triage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <StatePanel
          compact
          variant="empty"
          title="No feedback rows"
          description="Try another filter set or submit the first structured pilot item below."
        />
      )}

      {triageEditId ? (
        <div className="mt-4 rounded-[24px] border border-emerald-900/45 bg-emerald-950/20 p-5">
          <h3 className="text-base font-semibold text-emerald-100">Triage (PATCH)</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-slate-400">Status</span>
              <select
                className="mt-2 block w-full px-4 py-3 text-sm"
                value={triageStatus}
                onChange={(event) => setTriageStatus(event.target.value)}
              >
                {PILOT_FEEDBACK_STATUS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-slate-400">themeKey</span>
              <input
                className="mt-2 w-full px-4 py-3 font-mono text-sm"
                value={triageTheme}
                onChange={(event) => setTriageTheme(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={triageCritical}
                onChange={(event) => setTriageCritical(event.target.checked)}
              />
              Business critical
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-slate-400">Triage notes</span>
              <textarea
                className="mt-2 min-h-[88px] w-full px-4 py-3 text-sm"
                value={triageNotesText}
                onChange={(event) => setTriageNotesText(event.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" disabled={task !== null} onClick={() => void saveTriage()}>
              Save
            </Button>
            <Button type="button" variant="outline" disabled={task !== null} onClick={cancelTriage}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

export function NewPilotFeedbackSection({
  task,
  title,
  description,
  feedbackType,
  severity,
  moduleTag,
  blastRadius,
  evidenceQuality,
  requestId,
  branchIdFb,
  externalIncidentUrl,
  promoted,
  setTitle,
  setDescription,
  setFeedbackType,
  setSeverity,
  setModuleTag,
  setBlastRadius,
  setEvidenceQuality,
  setRequestId,
  setBranchIdFb,
  setExternalIncidentUrl,
  setPromoted,
  submitFeedback,
}: NewPilotFeedbackSectionProps) {
  return (
    <SectionCard
      title="New item"
      description="Post new pilot feedback with enough structure for weekly review, triage, and engineering follow-through."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-400">Type</span>
          <select
            className="mt-2 w-full px-4 py-3 text-sm"
            value={feedbackType}
            onChange={(event) => setFeedbackType(event.target.value)}
          >
            {PILOT_FEEDBACK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Severity</span>
          <select
            className="mt-2 w-full px-4 py-3 text-sm"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            {PILOT_FEEDBACK_SEVERITIES.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-slate-400">Title</span>
          <input
            className="mt-2 w-full px-4 py-3 text-sm"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-slate-400">Description</span>
          <textarea
            className="mt-2 min-h-[96px] w-full px-4 py-3 text-sm"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Evidence</span>
          <select
            className="mt-2 w-full px-4 py-3 text-sm"
            value={evidenceQuality}
            onChange={(event) => setEvidenceQuality(event.target.value)}
          >
            {PILOT_EVIDENCE_QUALITY.map((quality) => (
              <option key={quality} value={quality}>
                {quality}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Branch id (optional)</span>
          <input
            className="mt-2 w-full px-4 py-3 font-mono text-sm"
            value={branchIdFb}
            onChange={(event) => setBranchIdFb(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Module tag</span>
          <input
            className="mt-2 w-full px-4 py-3 text-sm"
            value={moduleTag}
            onChange={(event) => setModuleTag(event.target.value)}
            placeholder="kitchen, pos, qr-menu"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Blast radius</span>
          <input
            className="mt-2 w-full px-4 py-3 text-sm"
            value={blastRadius}
            onChange={(event) => setBlastRadius(event.target.value)}
            placeholder="single_branch, tenant_wide"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Request id</span>
          <input
            className="mt-2 w-full px-4 py-3 font-mono text-sm"
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">External incident URL</span>
          <input
            className="mt-2 w-full px-4 py-3 text-sm"
            value={externalIncidentUrl}
            onChange={(event) => setExternalIncidentUrl(event.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={promoted}
            onChange={(event) => setPromoted(event.target.checked)}
          />
          Promoted to engineering (flag)
        </label>
      </div>
      <Button
        type="button"
        className="mt-4"
        disabled={task !== null || !title.trim() || !description.trim()}
        onClick={() => void submitFeedback()}
      >
        Submit feedback
      </Button>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Mutating support actions flow through the server-side gateway and keep support secrets off the client.
      </p>
    </SectionCard>
  );
}
