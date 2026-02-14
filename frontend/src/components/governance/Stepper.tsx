interface Step {
  id: string;
  label: string;
  complete?: boolean;
}

interface StepperProps {
  steps: Step[];
  current: number;
}

export default function Stepper({ steps, current }: StepperProps) {
  return (
    <nav className="flex items-center justify-center" aria-label="Progress">
      <ol className="flex items-center space-x-4">
        {steps.map((step, idx) => (
          <li key={step.id} className="flex items-center">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                idx < current ? 'border-gov-blue bg-gov-blue text-white' :
                idx === current ? 'border-gov-blue bg-white text-gov-blue' :
                'border-slate-200 bg-white text-slate-400'
              }`}
            >
              {idx < current ? '✓' : idx + 1}
            </span>
            <span className={`ml-2 text-sm font-medium ${idx <= current ? 'text-gov-navy' : 'text-slate-400'}`}>
              {step.label}
            </span>
            {idx < steps.length - 1 && (
              <span className="mx-4 h-0.5 w-8 bg-slate-200" aria-hidden />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
