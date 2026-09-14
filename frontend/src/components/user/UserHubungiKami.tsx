import React from 'react';
import {
  Headphones,
  MapPin,
  Phone,
  Mail,
  Clock,
  ExternalLink,
  MessageCircle,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  Navigation
} from 'lucide-react';

const CONTACTS = {
  wa: '6281200000000',
  email: 'cs@berkahmulia.co.id',
  address: 'Jl. Koperasi Berkah Mulia No. 1, Kota Anda',
  mapsQuery: 'Koperasi Berkah Mulia',
  hours: [
    { d: 'Senin – Jumat', h: '08.00 – 16.00 WIB' },
    { d: 'Sabtu', h: '08.00 – 12.00 WIB' },
    { d: 'Minggu / Libur Nasional', h: 'Tutup' },
  ],
  sosmed: [
    { label: 'Instagram', href: 'https://instagram.com/berkahmulia.official', Icon: Instagram },
    { label: 'Facebook', href: 'https://facebook.com/berkahmulia', Icon: Facebook },
    { label: 'X / Twitter', href: 'https://x.com/berkahmulia', Icon: Twitter },
    { label: 'YouTube', href: 'https://youtube.com/@berkahmulia', Icon: Youtube },
  ],
};

const waUrl = (msg: string) => `https://wa.me/${CONTACTS.wa}?text=${encodeURIComponent(msg)}`;
const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACTS.mapsQuery)}`;

export const UserHubungiKami: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/25">
          <Headphones className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Hubungi Kami
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Koperasi Berkah Mulia siap membantu Anda setiap hari kerja
          </p>
        </div>
      </div>

      {/* Hero CTA */}
      <div className="rounded-3xl p-6 lg:p-8 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 shadow-lg shadow-emerald-600/20 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="max-w-md">
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            Butuh bantuan atau informasi?
          </h2>
          <p className="text-xs sm:text-sm text-emerald-50/90 mt-1">
            Tim kami siap merespon pertanyaan Anda secepatnya melalui WhatsApp, setiap hari kerja.
          </p>
        </div>
        <a
          href={waUrl('Assalamu\u2019alaikum, saya ingin bertanya tentang produk tabungan di Berkah Mulia.')}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-emerald-700 text-xs sm:text-sm font-extrabold shadow-md hover:scale-[1.03] active:scale-95 transition-all cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" />
          Hubungi via WhatsApp
        </a>
      </div>

      {/* Contact cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <ContactCard
          Icon={MapPin}
          label="Alamat"
          title="Kantor Koperasi"
          lines={[CONTACTS.address]}
          actionLabel="Buka di Google Maps"
          actionHref={mapsUrl}
        />
        <ContactCard
          Icon={Phone}
          label="WhatsApp"
          title={CONTACTS.wa}
          lines={['Gratis biaya percakapan', 'Jam layanan sesuai jadwal']}
          actionLabel="Chat Sekarang"
          actionHref={waUrl('Halo Berkah Mulia!')}
        />
        <ContactCard
          Icon={Mail}
          label="Email"
          title={CONTACTS.email}
          lines={['Balasan dalam 1x24 jam kerja']}
          actionLabel="Kirim Email"
          actionHref={`mailto:${CONTACTS.email}`}
        />
        <ContactCard
          Icon={Clock}
          label="Jam Operasional"
          title="Layanan Nasabah"
          lines={CONTACTS.hours.map((h) => `${h.d}: ${h.h}`)}
        />
      </div>

      {/* Sosmed */}
      <div className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Media Sosial Resmi
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CONTACTS.sosmed.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-500/50 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all cursor-pointer"
            >
              <s.Icon className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="flex-1 truncate">{s.label}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0 text-slate-400" />
            </a>
          ))}
        </div>
      </div>

      {/* Maps embedded */}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:border-emerald-500/50 transition-all group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Lokasi Kami
            </span>
          </div>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline flex items-center gap-1">
            Petunjuk Arah <ExternalLink className="w-3 h-3" />
          </span>
        </div>
        <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/60">
          <iframe
            title="Lokasi Koperasi Berkah Mulia di Google Maps"
            src={`https://www.google.com/maps?q=${encodeURIComponent(CONTACTS.mapsQuery)}&z=15&output=embed`}
            className="w-full h-56 sm:h-64"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </a>
    </div>
  );
};

// ─── Contact Card ────────────────────────────────
const ContactCard: React.FC<{
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  lines: string[];
  actionLabel?: string;
  actionHref?: string;
}> = ({ Icon, label, title, lines, actionLabel, actionHref }) => (
  <div className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col">
    <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
      <Icon className="w-4.5 h-4.5" />
    </div>
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
    <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 break-all">{title}</div>
    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 space-y-0.5 flex-1">
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
    {actionLabel && actionHref && (
      <a
        href={actionHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-[11px] font-extrabold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all cursor-pointer"
      >
        {actionLabel} <ExternalLink className="w-3 h-3" />
      </a>
    )}
  </div>
);