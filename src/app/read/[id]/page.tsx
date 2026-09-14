import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { publicArticle } from '@/lib/server/publicArticles';
import ArticleReader from '@/components/reader/ArticleReader';
const getArticle = cache(publicArticle);
export const revalidate = 60;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const article = await getArticle((await params).id);
  if (!article) return { title: 'Reading not found', robots: { index: false } };
  const url = `https://koreading.vercel.app/read/${article.id}`;
  const description = article.summaries?.en || article.summary || article.content.slice(0, 160);
  return { title: article.title, description, alternates: { canonical: url }, openGraph: { title: article.title, description, url, type: 'article' } };
}
export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const article = await getArticle((await params).id);
  if (!article) notFound();
  return <ArticleReader key={article.id} initialArticle={article} />;
}
