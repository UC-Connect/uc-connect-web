import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDoc, loadDocs, publicBody } from "@/lib/admissions/content";
import { TopicDetail } from "../_components/TopicDetail";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return loadDocs().map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const doc = getDoc((await params).slug);
  return doc ? { title: `${doc.titleZh} — UC Connect`, description: doc.summaryZh } : {};
}

export default async function TopicPage({ params }: { params: Promise<Params> }) {
  const doc = getDoc((await params).slug);

  if (!doc) {
    notFound();
  }

  const related = loadDocs()
    .filter((item) => item.slug !== doc.slug && (doc.audience === "all" || item.audience === doc.audience || item.audience === "all"))
    .sort((a, b) => Number(b.category === doc.category) - Number(a.category === doc.category) || a.order - b.order)
    .slice(0, 5)
    .map((item) => ({ slug: item.slug, title: item.title, titleZh: item.titleZh }));

  return (
    <TopicDetail
      doc={{
        slug: doc.slug,
        title: doc.title,
        titleZh: doc.titleZh,
        summary: doc.summary,
        summaryZh: doc.summaryZh,
        category: doc.category,
        audience: doc.audience,
        sourceUrl: doc.sourceUrl,
        supportingSourceUrl: doc.supportingSourceUrl,
        applicableCycle: doc.applicableCycle,
        lastReviewed: doc.lastReviewed,
      }}
      body={publicBody(doc)}
      related={related}
    />
  );
}
