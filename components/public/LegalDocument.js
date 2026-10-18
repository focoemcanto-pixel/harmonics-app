import Link from 'next/link';
import { parseMarkdown } from '@/lib/legal/markdown';

function Inline({ parts }) {
  return parts.map((part, index) => {
    if (part.type === 'strong') return <strong key={index} className="font-semibold text-white">{part.value}</strong>;
    if (part.type === 'link') {
      return part.href.startsWith('/')
        ? <Link key={index} href={part.href} className="text-violet-200 underline-offset-4 hover:underline">{part.value}</Link>
        : <a key={index} href={part.href} className="text-violet-200 underline-offset-4 hover:underline" rel="noopener noreferrer">{part.value}</a>;
    }
    return <span key={index}>{part.value}</span>;
  });
}

export default function LegalDocument({ markdown }) {
  const blocks = parseMarkdown(markdown);
  return (
    <article className="space-y-4 text-[15px] leading-7 text-slate-300">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          if (block.level === 1) return <h1 key={index} className="text-3xl font-semibold tracking-tight text-white md:text-4xl"><Inline parts={block.inline} /></h1>;
          return <h2 key={index} className="pt-4 text-xl font-semibold text-white"><Inline parts={block.inline} /></h2>;
        }
        if (block.type === 'list') {
          return (
            <ul key={index} className="list-disc space-y-1 pl-6">
              {block.items.map((item, itemIndex) => <li key={itemIndex}><Inline parts={item} /></li>)}
            </ul>
          );
        }
        if (block.type === 'table') {
          return (
            <div key={index} className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.06] text-white">
                  <tr>{block.header.map((cell, c) => <th key={c} className="px-4 py-3 font-semibold"><Inline parts={cell} /></th>)}</tr>
                </thead>
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r} className="border-t border-white/10">
                      {row.map((cell, c) => <td key={c} className="px-4 py-3 align-top"><Inline parts={cell} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={index}><Inline parts={block.inline} /></p>;
      })}
    </article>
  );
}
