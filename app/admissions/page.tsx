import { getTimeline, loadDocs } from "@/lib/admissions/content";
import type { DocCard } from "@/lib/admissions/presentation";
import { AdmissionsHub } from "./_components/AdmissionsHub";

export default function AdmissionsPage() {
  const docs: DocCard[] = loadDocs().map(({ slug, title, titleZh, summary, summaryZh, category, order, audience, lastReviewed }) => ({
    slug,
    title,
    titleZh,
    summary,
    summaryZh,
    category,
    order,
    audience,
    lastReviewed,
  }));

  return (
    <AdmissionsHub
      docs={docs}
      timelines={{ freshman: getTimeline("freshman"), transfer: getTimeline("transfer") }}
    />
  );
}
