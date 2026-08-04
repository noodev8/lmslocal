'use client';

import { useState } from 'react';
import { supportApi } from '@/lib/api';
import { LABEL } from '@/lib/design';

/**
 * The contact form in the help centre. Kept short on purpose: name, email, what it is about, and
 * the message. Anything more is a reason not to bother writing in.
 *
 * The subject list must stay in step with SUBJECTS in routes/submit-contact-message.js.
 */

const SUBJECTS = [
  'Joining a competition',
  'Running a competition',
  'Picks and results',
  'Billing and credits',
  'Something is broken',
  'Something else'
];

const input =
  'mt-2 block w-full rounded-sm border border-ink/40 bg-stock-lit px-3 py-2.5 text-[17px] text-ink placeholder:text-ink-fade/70 focus:border-ink focus:outline-none';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const res = await supportApi.sendMessage({ name, email, subject, message, website });
      if (res.data.return_code === 'SUCCESS') {
        setSent(true);
      } else {
        setError(res.data.message || 'We could not send that. Please try again.');
      }
    } catch {
      setError('We could not send that just now. Please email noodev8@gmail.com instead.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="border border-ink/30 bg-stock-lit p-6">
        <h2 className="font-display text-3xl uppercase tracking-[0.03em] text-ink">
          Message sent
        </h2>
        <p className="mt-3 text-[17px] leading-relaxed text-ink">
          Thanks. We read everything and reply to <strong className="font-semibold">{email}</strong>,
          usually the same day.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setMessage('');
          }}
          className={`${LABEL} mt-5 text-ink-fade underline decoration-dotted underline-offset-4 hover:text-ink`}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg">
      {error && (
        <p className="mb-6 border-l-2 border-overprint bg-stock-lit px-4 py-3 text-[17px] text-ink">
          {error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={`${LABEL} text-ink-fade`}>Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={input} />
        </label>
        <label className="block">
          <span className={`${LABEL} text-ink-fade`}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={input}
          />
        </label>
      </div>

      <label className="mt-5 block">
        <span className={`${LABEL} text-ink-fade`}>What is it about?</span>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={`${input} cursor-pointer`}
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-5 block">
        <span className={`${LABEL} text-ink-fade`}>Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          rows={6}
          placeholder="What has happened, and what were you trying to do?"
          className={`${input} resize-y`}
        />
      </label>

      {/* Honeypot — hidden from people, irresistible to simple bots */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="mt-7 rounded-sm bg-overprint px-8 py-4 font-display text-2xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {busy ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
