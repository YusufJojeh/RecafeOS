import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useCallback, useState } from 'react';

interface AccordionItemProps {
  question: string;
  answer: string;
}

function AccordionItem({ question, answer }: AccordionItemProps) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  return (
    <div
      className={clsx(
        'rounded-[1.75rem] border border-white/10 bg-white/[0.04] px-5 transition-all duration-300 sm:px-6',
        open && 'border-white/16 bg-white/[0.07] shadow-[0_24px_70px_-42px_rgba(16,185,129,0.5)]',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-start font-medium text-white"
        aria-expanded={open}
      >
        <span className="text-base leading-7 sm:text-lg">{question}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-brand-300 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 pb-5' : 'max-h-0'}`}
      >
        <p className="text-sm leading-7 text-slate-300 sm:text-[15px]">{answer}</p>
      </div>
    </div>
  );
}

interface AccordionProps {
  items: Array<{ question: string; answer: string }>;
}

export function Accordion({ items }: AccordionProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <AccordionItem
          key={item.question}
          question={item.question}
          answer={item.answer}
        />
      ))}
    </div>
  );
}
