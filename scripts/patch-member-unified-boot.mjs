import fs from 'node:fs';

const path = 'app/membro/page.js';
let source = fs.readFileSync(path, 'utf8');
const original = source;

if (!source.includes('function MemberBootScreen(')) {
  source = source.replace(
    'function LoginScreen({ onGoogleLogin, loggingIn, error }) {',
    `function MemberBootScreen({ memberName = '' }) {\n  return (\n    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#050814] px-6 text-white">\n      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(124,58,237,.28),transparent_34%),radial-gradient(circle_at_50%_78%,rgba(59,130,246,.12),transparent_32%)]" />\n      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:34px_34px]" />\n\n      <div className="relative z-10 flex w-full max-w-[430px] flex-col items-center text-center">\n        <div className="relative flex h-28 w-28 items-center justify-center">\n          <div className="absolute inset-0 rounded-full border border-violet-400/20 bg-violet-500/10 blur-[1px]" />\n          <div className="absolute inset-2 animate-ping rounded-full border border-violet-400/10 [animation-duration:2.4s]" />\n          <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-black shadow-[0_20px_55px_rgba(124,58,237,.28)]">\n            <span className="font-serif text-[38px] italic text-white">H</span>\n          </div>\n        </div>\n\n        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-violet-200">\n          Harmonics Member\n        </div>\n\n        <h1 className="mt-6 text-[30px] font-black tracking-[-0.05em] text-white">\n          Preparando sua agenda\n        </h1>\n        <p className="mt-3 max-w-[320px] text-[14px] font-semibold leading-6 text-white/55">\n          {memberName ? \\`Só um instante, \\${String(memberName).split(' ')[0]}. Estamos organizando seus eventos e repertórios.\\` : 'Organizando seus eventos, escalas e repertórios para deixar tudo pronto.'}\n        </p>\n\n        <div className="mt-8 h-1.5 w-44 overflow-hidden rounded-full bg-white/8">\n          <div className="h-full w-2/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#7c3aed,#a78bfa,#7c3aed)] shadow-[0_0_20px_rgba(139,92,246,.65)]" />\n        </div>\n\n        <div className="mt-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/35">\n          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />\n          Sincronizando painel\n        </div>\n      </div>\n    </div>\n  );\n}\n\nfunction LoginScreen({ onGoogleLogin, loggingIn, error }) {`
  );
}

source = source.replace(
  /  if \(!sessionChecked\) \{\s*return \(\s*<div className="flex min-h-screen items-center justify-center bg-\[#050814\] text-white">[\s\S]*?<\/div>\s*\);\s*\}/m,
  `  if (!sessionChecked) {\n    return <MemberBootScreen />;\n  }`
);

if (!source.includes('if (member && loadingData) {\n    return <MemberBootScreen')) {
  source = source.replace(
    /(  if \(!member\) \{[\s\S]*?\n  \}\n\n)(  return \()/m,
    `$1  if (member && loadingData) {\n    return <MemberBootScreen memberName={member?.name || ''} />;\n  }\n\n$2`
  );
}

source = source.replace('{showWelcomeSplash ? (', '{false && showWelcomeSplash ? (');

if (source === original) {
  console.log('[member unified boot] já aplicado/sem alterações');
} else {
  fs.writeFileSync(path, source);
  console.log('[member unified boot] experiência de carregamento unificada');
}
